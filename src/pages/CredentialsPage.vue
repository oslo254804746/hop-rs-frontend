<script setup lang="ts">
import {
  Check,
  ChevronRight,
  CircleDotDashed,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import CredentialEditor from '@/components/credentials/CredentialEditor.vue'
import { getPanelRuntimeConfig } from '@/api'
import {
  BaseButton,
  ConfirmDialog,
  EmptyState,
  InlineNotice,
  StatusBadge,
} from '@/components/ui'
import type { Credential, CredentialAuthType, CredentialWriteInput } from '@/domain'
import { useI18n } from '@/i18n'
import {
  useCreateCredentialMutation,
  useCredentialsQuery,
  useDeleteCredentialMutation,
  useHopApiRuntime,
  useUpdateCredentialMutation,
} from '@/queries'

type EditorMode = 'create' | 'rotate' | null

const credentialsQuery = useCredentialsQuery()
const createMutation = useCreateCredentialMutation()
const updateMutation = useUpdateCredentialMutation()
const deleteMutation = useDeleteCredentialMutation()
const runtime = useHopApiRuntime()
const { t } = useI18n()
const isOpenWrt = getPanelRuntimeConfig().deployment === 'openwrt'

const search = ref('')
const selectedId = ref<string | null>(null)
const editorMode = ref<EditorMode>(null)
const deleteOpen = ref(false)
const successMessage = ref<string | null>(null)
const operationError = ref<string | null>(null)

const credentials = computed(() => credentialsQuery.data.value ?? [])
const filteredCredentials = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return credentials.value
  return credentials.value.filter((credential) =>
    [credential.name, credential.username, authLabel(credential.authType)]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query),
  )
})
const selectedCredential = computed(
  () => credentials.value.find((credential) => credential.id === selectedId.value) ?? null,
)
const mutationPending = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value || deleteMutation.isPending.value,
)
const selectedConfigManaged = computed(
  () => selectedCredential.value?.management?.mode === 'config',
)
const queryError = computed(() => errorMessage(credentialsQuery.error.value))

watch(
  credentials,
  (items) => {
    if (items.length === 0) {
      selectedId.value = null
      return
    }
    if (!items.some((item) => item.id === selectedId.value) && editorMode.value !== 'create') {
      selectedId.value = items[0]?.id ?? null
    }
  },
  { immediate: true },
)

function authLabel(authType: CredentialAuthType) {
  if (authType === 'password') return t('Password')
  if (authType === 'key') return t('Private key')
  return t('Key + passphrase')
}

function secretSummary(credential: Credential) {
  if (credential.authType === 'password') return t(credential.password === 'configured' ? 'Password set' : 'Password missing')
  if (credential.authType === 'key_passphrase') {
    return credential.privateKey === 'configured' && credential.passphrase === 'configured'
      ? t('Key and passphrase set')
      : t('Secret incomplete')
  }
  return t(credential.privateKey === 'configured' ? 'Private key set' : 'Private key missing')
}

function hasConfiguredSecret(credential: Credential) {
  if (credential.authType === 'password') return credential.password === 'configured'
  if (credential.authType === 'key') return credential.privateKey === 'configured'
  return credential.privateKey === 'configured' && credential.passphrase === 'configured'
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return error ? String(error) : ''
}

function clearOperationState() {
  successMessage.value = null
  operationError.value = null
  createMutation.reset()
  updateMutation.reset()
  deleteMutation.reset()
}

function selectCredential(id: string) {
  selectedId.value = id
  editorMode.value = null
  clearOperationState()
}

function openCreate() {
  clearOperationState()
  editorMode.value = 'create'
}

function openRotate() {
  if (!selectedCredential.value || selectedConfigManaged.value) return
  clearOperationState()
  editorMode.value = 'rotate'
}

function closeEditor() {
  editorMode.value = null
  operationError.value = null
}

async function createCredential(input: CredentialWriteInput) {
  clearOperationState()
  try {
    const created = await createMutation.mutateAsync(input)
    selectedId.value = created.id
    editorMode.value = null
    successMessage.value = `${created.name} was created. Its secret will not be shown again.`
  } catch (error) {
    operationError.value = errorMessage(error)
  }
}

async function rotateCredential(input: CredentialWriteInput) {
  const credential = selectedCredential.value
  if (!credential || selectedConfigManaged.value) return

  clearOperationState()
  try {
    const updated = await updateMutation.mutateAsync({ id: credential.id, input })
    editorMode.value = null
    successMessage.value = `${updated.name} now uses the new secret.`
  } catch (error) {
    operationError.value = errorMessage(error)
  }
}

async function deleteCredential() {
  const credential = selectedCredential.value
  if (!credential || selectedConfigManaged.value) return

  clearOperationState()
  try {
    await deleteMutation.mutateAsync(credential.id)
    deleteOpen.value = false
    editorMode.value = null
    successMessage.value = `${credential.name} was deleted.`
  } catch (error) {
    deleteOpen.value = false
    operationError.value = errorMessage(error)
  }
}
</script>

<template>
  <div class="page-stack credentials-page">
    <header class="page-intro credentials-page__intro">
      <div>
        <h1>{{ t('Credentials') }}</h1>
        <p>{{ t('Target authentication material. Stored secrets are reported only as configured or missing.') }}</p>
      </div>
      <div class="credentials-page__intro-actions">
        <button
          class="credentials-page__icon-button"
          type="button"
          :disabled="credentialsQuery.isFetching.value"
          :aria-label="t('Refresh credentials')"
          :title="t('Refresh credentials')"
          @click="credentialsQuery.refetch()"
        >
          <RefreshCw
            :size="18"
            :class="{ 'is-spinning': credentialsQuery.isFetching.value }"
            aria-hidden="true"
          />
        </button>
        <BaseButton
          variant="primary"
          :disabled="!runtime.ready.value"
          @click="openCreate"
        >
          <template #leading>
            <Plus />
          </template>
          {{ t('New credential') }}
        </BaseButton>
      </div>
    </header>

    <InlineNotice
      v-if="runtime.mode.value === 'reauth'"
      tone="warning"
      :title="t('Reconnect to manage credentials')"
    >
      {{ t('Reauthentication explanation') }}
    </InlineNotice>

    <InlineNotice
      v-if="successMessage"
      tone="success"
      :title="t('Catalog updated')"
    >
      {{ successMessage }}
    </InlineNotice>

    <InlineNotice
      v-if="operationError && editorMode === null"
      tone="danger"
      :title="t('Credential action failed')"
    >
      {{ operationError }}
    </InlineNotice>

    <section class="credentials-workspace">
      <div class="credentials-list panel">
        <div class="credentials-list__toolbar">
          <label class="credentials-list__search">
            <Search
              :size="17"
              aria-hidden="true"
            />
            <span class="sr-only">{{ t('Search credentials') }}</span>
            <input
              v-model="search"
              type="search"
              :placeholder="t('Search name or username')"
              autocomplete="off"
            >
            <button
              v-if="search"
              type="button"
              :aria-label="t('Clear search')"
              @click="search = ''"
            >
              <X
                :size="16"
                aria-hidden="true"
              />
            </button>
          </label>
          <span class="credentials-list__count tabular">
            {{ filteredCredentials.length }} / {{ credentials.length }}
          </span>
        </div>

        <div
          v-if="credentialsQuery.isPending.value"
          class="credentials-list__loading"
          aria-label="Loading credentials"
        >
          <span
            v-for="index in 4"
            :key="index"
          />
        </div>

        <InlineNotice
          v-else-if="credentialsQuery.isError.value && credentials.length === 0"
          class="credentials-list__error"
          tone="danger"
          :title="t('Credentials could not be loaded')"
        >
          {{ queryError }}
          <template #actions>
            <BaseButton
              variant="secondary"
              @click="credentialsQuery.refetch()"
            >
              {{ t('Retry') }}
            </BaseButton>
          </template>
        </InlineNotice>

        <EmptyState
          v-else-if="credentials.length === 0"
          :title="t('No credentials yet')"
          :description="t('Create a credential to let SSH assets authenticate to a target.')"
          :icon="KeyRound"
          compact
        >
          <template #actions>
            <BaseButton
              variant="primary"
              @click="openCreate"
            >
              {{ t('Create credential') }}
            </BaseButton>
          </template>
        </EmptyState>

        <EmptyState
          v-else-if="filteredCredentials.length === 0"
          :title="t('No matching credentials')"
          :description="t('Try another name or username.')"
          :icon="Search"
          compact
        >
          <template #actions>
            <BaseButton
              variant="secondary"
              @click="search = ''"
            >
              {{ t('Clear search') }}
            </BaseButton>
          </template>
        </EmptyState>

        <ul
          v-else
          class="credentials-list__rows"
          aria-label="Credentials"
        >
          <li
            v-for="credential in filteredCredentials"
            :key="credential.id"
          >
            <button
              class="credential-row"
              :class="{ 'credential-row--selected': credential.id === selectedId && editorMode !== 'create' }"
              type="button"
              :aria-current="credential.id === selectedId && editorMode !== 'create' ? 'true' : undefined"
              @click="selectCredential(credential.id)"
            >
              <span
                class="credential-row__mark"
                aria-hidden="true"
              >
                <KeyRound :size="18" />
              </span>
              <span class="credential-row__primary">
                <strong>{{ credential.name }}</strong>
                <small><UserRound
                  :size="13"
                  aria-hidden="true"
                />{{ credential.username }}</small>
              </span>
              <span class="credential-row__meta">
                <StatusBadge
                  :label="secretSummary(credential)"
                  :tone="hasConfiguredSecret(credential) ? 'success' : 'warning'"
                  :icon="hasConfiguredSecret(credential) ? Check : ShieldAlert"
                />
                <small>{{ authLabel(credential.authType) }}</small>
              </span>
              <ChevronRight
                :size="17"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>
      </div>

      <aside
        class="credentials-detail panel"
        aria-label="Credential details"
      >
        <CredentialEditor
          v-if="editorMode === 'create'"
          mode="create"
          :busy="mutationPending"
          v-bind="operationError ? { error: operationError } : {}"
          @cancel="closeEditor"
          @submit="createCredential"
        />

        <CredentialEditor
          v-else-if="editorMode === 'rotate' && selectedCredential"
          mode="rotate"
          :credential="selectedCredential"
          :busy="mutationPending"
          v-bind="operationError ? { error: operationError } : {}"
          @cancel="closeEditor"
          @submit="rotateCredential"
        />

        <template v-else-if="selectedCredential">
          <header class="credentials-detail__header">
            <span
              class="credentials-detail__mark"
              aria-hidden="true"
            ><KeyRound :size="21" /></span>
            <div>
              <h2>{{ selectedCredential.name }}</h2>
              <p>{{ authLabel(selectedCredential.authType) }} for <strong>{{ selectedCredential.username }}</strong></p>
            </div>
            <StatusBadge
              :label="t(hasConfiguredSecret(selectedCredential) ? 'Ready' : 'Incomplete')"
              :tone="hasConfiguredSecret(selectedCredential) ? 'success' : 'warning'"
            />
          </header>

          <InlineNotice
            v-if="selectedConfigManaged"
            tone="warning"
            :title="t(isOpenWrt ? 'OpenWrt managed config title' : 'Managed by hop.yaml')"
          >
            {{ t('Config credential read-only explanation') }}
          </InlineNotice>

          <dl class="credentials-detail__facts">
            <div>
              <dt>{{ t('Username') }}</dt>
              <dd>{{ selectedCredential.username }}</dd>
            </div>
            <div>
              <dt>{{ t('Authentication') }}</dt>
              <dd>{{ authLabel(selectedCredential.authType) }}</dd>
            </div>
            <div>
              <dt>{{ t('Credential ID') }}</dt>
              <dd class="mono">
                {{ selectedCredential.id }}
              </dd>
            </div>
            <div>
              <dt>{{ t('Ownership') }}</dt>
              <dd>
                {{ t(selectedConfigManaged ? 'Configuration file ownership' : 'Panel / local ownership') }}
              </dd>
            </div>
          </dl>

          <section
            class="credentials-detail__secrets"
            aria-labelledby="credential-secret-status"
          >
            <div>
              <h3 id="credential-secret-status">
                {{ t('Secret status') }}
              </h3>
              <p>{{ t('Values are intentionally unavailable after write.') }}</p>
            </div>
            <ul>
              <li>
                <span>{{ t('Password') }}</span>
                <StatusBadge
                  :label="t(selectedCredential.password === 'configured' ? 'Configured' : 'Not used status')"
                  :tone="selectedCredential.password === 'configured' ? 'success' : 'neutral'"
                />
              </li>
              <li>
                <span>{{ t('Private key') }}</span>
                <StatusBadge
                  :label="t(selectedCredential.privateKey === 'configured' ? 'Configured' : 'Not used status')"
                  :tone="selectedCredential.privateKey === 'configured' ? 'success' : 'neutral'"
                />
              </li>
              <li>
                <span>Passphrase</span>
                <StatusBadge
                  :label="t(selectedCredential.passphrase === 'configured' ? 'Configured' : 'Not used status')"
                  :tone="selectedCredential.passphrase === 'configured' ? 'success' : 'neutral'"
                />
              </li>
            </ul>
          </section>

          <footer v-if="!selectedConfigManaged" class="credentials-detail__actions">
            <BaseButton
              variant="secondary"
              :disabled="!runtime.ready.value"
              @click="openRotate"
            >
              <template #leading>
                <RotateCw />
              </template>
              {{ t('Rotate secret') }}
            </BaseButton>
            <BaseButton
              variant="quiet"
              :disabled="!runtime.ready.value"
              @click="deleteOpen = true"
            >
              <template #leading>
                <Trash2 />
              </template>
              {{ t('Delete') }}
            </BaseButton>
          </footer>
        </template>

        <EmptyState
          v-else
          :title="t('Select a credential')"
          :description="t('Choose a row to inspect its non-secret metadata.')"
          :icon="CircleDotDashed"
          compact
        />
      </aside>
    </section>

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="t('Delete credential?')"
      :description="selectedCredential
        ? `${selectedCredential.name} will be removed. Assets that still reference it can make this request fail.`
        : 'This credential will be removed.'"
      :confirm-label="t('Delete credential')"
      :busy="deleteMutation.isPending.value"
      @confirm="deleteCredential"
    />
  </div>
</template>

<style scoped>
.credentials-page {
  --detail-width: minmax(310px, 0.72fr);
}

.credentials-page__intro-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.credentials-page__icon-button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--surface-raised);
  cursor: pointer;
}

.credentials-page__icon-button:hover:not(:disabled) {
  color: var(--text-strong);
  border-color: var(--line-strong);
}

.credentials-page__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.is-spinning {
  animation: credentials-spin 800ms linear infinite;
}

.credentials-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--detail-width);
  gap: 12px;
  min-height: 560px;
}

.credentials-list,
.credentials-detail {
  min-width: 0;
  overflow: hidden;
}

.credentials-list__toolbar {
  display: flex;
  min-height: 60px;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}

.credentials-list__search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 44px;
  padding: 0 8px 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--surface-input);
}

.credentials-list__search:focus-within {
  border-color: var(--focus);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 24%, transparent);
}

.credentials-list__search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--text-strong);
  background: transparent;
}

.credentials-list__search input::placeholder {
  color: var(--text-muted);
}

.credentials-list__search button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 7px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}

.credentials-list__search button:hover {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.credentials-list__count {
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.credentials-list__rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.credentials-list__rows li + li {
  border-top: 1px solid var(--line);
}

.credential-row {
  display: grid;
  grid-template-columns: 38px minmax(130px, 1fr) minmax(150px, auto) auto;
  gap: 11px;
  width: 100%;
  min-height: 64px;
  align-items: center;
  padding: 8px 12px;
  color: var(--text);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.credential-row:hover {
  background: var(--surface-hover);
}

.credential-row:focus-visible {
  position: relative;
  z-index: 1;
  outline-offset: -2px;
}

.credential-row--selected {
  background: var(--surface-selected);
}

.credential-row__mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 9px;
  color: var(--accent);
  background: var(--accent-soft);
}

.credential-row__primary,
.credential-row__meta {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.credential-row__primary strong,
.credential-row__primary small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credential-row__primary strong {
  color: var(--text-strong);
  font-size: 0.875rem;
}

.credential-row__primary small {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.credential-row__meta {
  justify-items: end;
}

.credential-row__meta small {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.credential-row > svg {
  color: var(--text-muted);
}

.credentials-list__loading {
  display: grid;
}

.credentials-list__loading span {
  height: 64px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(90deg, var(--surface-panel) 15%, var(--surface-raised) 48%, var(--surface-panel) 82%);
  background-size: 240% 100%;
  animation: credentials-shimmer 1.2s ease-in-out infinite;
}

.credentials-list__error {
  margin: 12px;
}

.credentials-detail {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 18px;
}

.credentials-detail__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 11px;
}

.credentials-detail__mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 10px;
  color: var(--accent);
  background: var(--accent-soft);
}

.credentials-detail__header h2 {
  margin: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credentials-detail__header p {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.credentials-detail__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.credentials-detail__facts div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 11px 12px;
}

.credentials-detail__facts div:nth-child(even) {
  border-left: 1px solid var(--line);
}

.credentials-detail__facts div:nth-child(n + 3) {
  border-top: 1px solid var(--line);
}

.credentials-detail__facts dt {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.credentials-detail__facts dd {
  margin: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credentials-detail__secrets {
  display: grid;
  gap: 10px;
}

.credentials-detail__secrets h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 0.875rem;
}

.credentials-detail__secrets p {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.credentials-detail__secrets ul {
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  list-style: none;
  overflow: hidden;
}

.credentials-detail__secrets li {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 11px;
}

.credentials-detail__secrets li + li {
  border-top: 1px solid var(--line);
}

.credentials-detail__secrets li > span:first-child {
  color: var(--text);
  font-size: 0.8125rem;
}

.credentials-detail__actions {
  display: flex;
  gap: 8px;
  padding-top: 2px;
}

@keyframes credentials-spin {
  to { transform: rotate(360deg); }
}

@keyframes credentials-shimmer {
  to { background-position: -140% 0; }
}

@media (max-width: 1120px) {
  .credentials-workspace {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.86fr);
  }

  .credential-row {
    grid-template-columns: 38px minmax(0, 1fr) auto;
  }

  .credential-row__meta {
    display: none;
  }
}

@media (max-width: 820px) {
  .credentials-workspace {
    grid-template-columns: 1fr;
  }

  .credentials-detail {
    min-height: 380px;
  }
}

@media (max-width: 600px) {
  .credentials-page__intro {
    align-items: stretch;
  }

  .credentials-page__intro,
  .credentials-page__intro-actions {
    flex-direction: column;
  }

  .credentials-page__intro-actions {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .credentials-page__intro-actions :deep(.base-button) {
    width: 100%;
  }

  .credentials-detail__facts {
    grid-template-columns: 1fr;
  }

  .credentials-detail__facts div:nth-child(even) {
    border-left: 0;
  }

  .credentials-detail__facts div:nth-child(n + 2) {
    border-top: 1px solid var(--line);
  }

  .credentials-detail__header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .credentials-detail__header > :last-child {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .credentials-detail__actions {
    flex-direction: column;
  }

  .credentials-detail__actions :deep(.base-button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-spinning,
  .credentials-list__loading span {
    animation: none;
  }
}
</style>
