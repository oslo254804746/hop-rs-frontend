<script setup lang="ts">
import {
  Ban,
  Check,
  ChevronRight,
  CircleDotDashed,
  Fingerprint,
  Globe2,
  KeyRound,
  ListChecks,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import AccessEditor from '@/components/access/AccessEditor.vue'
import {
  BaseButton,
  ConfirmDialog,
  EmptyState,
  InlineNotice,
  StatusBadge,
} from '@/components/ui'
import type { AccessKey, AccessKeyCreateInput } from '@/domain'
import {
  useAccessKeysQuery,
  useAssetsQuery,
  useCreateAccessKeyMutation,
  useDeleteAccessKeyMutation,
  useHopApiRuntime,
  useSetAccessKeyAccessMutation,
  useSetAccessKeyEnabledMutation,
} from '@/queries'

type EditorMode = 'create' | 'scope' | null

const accessKeysQuery = useAccessKeysQuery()
const assetsQuery = useAssetsQuery()
const createMutation = useCreateAccessKeyMutation()
const enabledMutation = useSetAccessKeyEnabledMutation()
const accessMutation = useSetAccessKeyAccessMutation()
const deleteMutation = useDeleteAccessKeyMutation()
const runtime = useHopApiRuntime()

const search = ref('')
const selectedId = ref<string | null>(null)
const editorMode = ref<EditorMode>(null)
const deleteOpen = ref(false)
const successMessage = ref<string | null>(null)
const operationError = ref<string | null>(null)

const accessKeys = computed(() => accessKeysQuery.data.value ?? [])
const assets = computed(() => assetsQuery.data.value ?? [])
const assetsById = computed(() => new Map(assets.value.map((asset) => [asset.id, asset])))
const filteredAccessKeys = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return accessKeys.value
  return accessKeys.value.filter((accessKey) =>
    [accessKey.name, accessKey.fingerprint, scopeLabel(accessKey)]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query),
  )
})
const selectedAccessKey = computed(
  () => accessKeys.value.find((accessKey) => accessKey.id === selectedId.value) ?? null,
)
const selectedManagedSource = computed(() => {
  const management = selectedAccessKey.value?.management
  return management?.mode === 'declarative' ? management.sourceId : null
})
const selectedAssets = computed(() => {
  const ids = selectedAccessKey.value?.assetIds
  if (ids === null || ids === undefined) return []
  return ids.map((id) => ({ id, name: assetsById.value.get(id)?.name ?? id }))
})
const mutationPending = computed(
  () =>
    createMutation.isPending.value ||
    enabledMutation.isPending.value ||
    accessMutation.isPending.value ||
    deleteMutation.isPending.value,
)
const queryError = computed(() => errorMessage(accessKeysQuery.error.value))

watch(
  accessKeys,
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

function scopeLabel(accessKey: AccessKey) {
  if (accessKey.assetIds === null) return 'All assets'
  if (accessKey.assetIds.length === 0) return 'No assets'
  return `${accessKey.assetIds.length} ${accessKey.assetIds.length === 1 ? 'asset' : 'assets'}`
}

function scopeTone(accessKey: AccessKey) {
  if (accessKey.assetIds === null) return 'info' as const
  if (accessKey.assetIds.length === 0) return 'warning' as const
  return 'neutral' as const
}

function scopeIcon(accessKey: AccessKey) {
  if (accessKey.assetIds === null) return Globe2
  if (accessKey.assetIds.length === 0) return Ban
  return ListChecks
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return error ? String(error) : ''
}

function clearOperationState() {
  successMessage.value = null
  operationError.value = null
  createMutation.reset()
  enabledMutation.reset()
  accessMutation.reset()
  deleteMutation.reset()
}

function selectAccessKey(id: string) {
  selectedId.value = id
  editorMode.value = null
  clearOperationState()
}

function openCreate() {
  clearOperationState()
  editorMode.value = 'create'
}

function openScope() {
  if (!selectedAccessKey.value || selectedManagedSource.value) return
  clearOperationState()
  editorMode.value = 'scope'
}

function closeEditor() {
  editorMode.value = null
  operationError.value = null
}

async function createAccessKey(input: AccessKeyCreateInput) {
  clearOperationState()
  try {
    const created = await createMutation.mutateAsync(input)
    selectedId.value = created.id
    editorMode.value = null
    successMessage.value = `${created.name} was registered with fingerprint ${created.fingerprint}. Hop did not generate a private key.`
  } catch (error) {
    operationError.value = errorMessage(error)
  }
}

async function updateScope(assetIds: string[] | null) {
  const accessKey = selectedAccessKey.value
  if (!accessKey || selectedManagedSource.value) return

  clearOperationState()
  try {
    const updated = await accessMutation.mutateAsync({ id: accessKey.id, assetIds })
    editorMode.value = null
    successMessage.value = `${updated.name} now has ${scopeLabel(updated).toLocaleLowerCase()}.`
  } catch (error) {
    operationError.value = errorMessage(error)
  }
}

async function toggleEnabled() {
  const accessKey = selectedAccessKey.value
  if (!accessKey || selectedManagedSource.value) return

  clearOperationState()
  try {
    const updated = await enabledMutation.mutateAsync({ id: accessKey.id, enabled: !accessKey.enabled })
    successMessage.value = `${updated.name} is now ${updated.enabled ? 'enabled' : 'disabled'}.`
  } catch (error) {
    operationError.value = errorMessage(error)
  }
}

async function deleteAccessKey() {
  const accessKey = selectedAccessKey.value
  if (!accessKey || selectedManagedSource.value) return

  clearOperationState()
  try {
    await deleteMutation.mutateAsync(accessKey.id)
    deleteOpen.value = false
    editorMode.value = null
    successMessage.value = `${accessKey.name} was deleted.`
  } catch (error) {
    deleteOpen.value = false
    operationError.value = errorMessage(error)
  }
}
</script>

<template>
  <div class="page-stack access-page">
    <header class="page-intro access-page__intro">
      <div>
        <h1>Access</h1>
        <p>Ingress SSH public keys and the exact Catalog assets each key may reach.</p>
      </div>
      <div class="access-page__intro-actions">
        <button
          class="access-page__icon-button"
          type="button"
          :disabled="accessKeysQuery.isFetching.value"
          aria-label="Refresh access keys"
          title="Refresh access keys"
          @click="accessKeysQuery.refetch()"
        >
          <RefreshCw
            :size="18"
            :class="{ 'is-spinning': accessKeysQuery.isFetching.value }"
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
          Add public key
        </BaseButton>
      </div>
    </header>

    <InlineNotice
      v-if="runtime.mode.value === 'reauth'"
      tone="warning"
      title="Reconnect to manage access"
    >
      Your management token is intentionally absent after a refresh. Reconnect from the global connection control.
    </InlineNotice>

    <InlineNotice
      v-if="successMessage"
      tone="success"
      title="Catalog updated"
    >
      {{ successMessage }}
    </InlineNotice>

    <InlineNotice
      v-if="operationError && editorMode === null"
      tone="danger"
      title="Access action failed"
    >
      {{ operationError }}
    </InlineNotice>

    <section class="access-workspace">
      <div class="access-list panel">
        <div class="access-list__toolbar">
          <label class="access-list__search">
            <Search
              :size="17"
              aria-hidden="true"
            />
            <span class="sr-only">Search access keys</span>
            <input
              v-model="search"
              type="search"
              placeholder="Search key or fingerprint"
              autocomplete="off"
            >
            <button
              v-if="search"
              type="button"
              aria-label="Clear search"
              @click="search = ''"
            >
              <X
                :size="16"
                aria-hidden="true"
              />
            </button>
          </label>
          <span class="access-list__count tabular">
            {{ filteredAccessKeys.length }} / {{ accessKeys.length }}
          </span>
        </div>

        <div
          v-if="accessKeysQuery.isPending.value"
          class="access-list__loading"
          aria-label="Loading access keys"
        >
          <span
            v-for="index in 4"
            :key="index"
          />
        </div>

        <InlineNotice
          v-else-if="accessKeysQuery.isError.value && accessKeys.length === 0"
          class="access-list__error"
          tone="danger"
          title="Access keys could not be loaded"
        >
          {{ queryError }}
          <template #actions>
            <BaseButton
              variant="secondary"
              @click="accessKeysQuery.refetch()"
            >
              Retry
            </BaseButton>
          </template>
        </InlineNotice>

        <EmptyState
          v-else-if="accessKeys.length === 0"
          title="No access keys yet"
          description="Register an SSH public key to authorize ingress into Hop."
          :icon="KeyRound"
          compact
        >
          <template #actions>
            <BaseButton
              variant="primary"
              @click="openCreate"
            >
              Add public key
            </BaseButton>
          </template>
        </EmptyState>

        <EmptyState
          v-else-if="filteredAccessKeys.length === 0"
          title="No matching access keys"
          description="Try another name, fingerprint, or scope."
          :icon="Search"
          compact
        >
          <template #actions>
            <BaseButton
              variant="secondary"
              @click="search = ''"
            >
              Clear search
            </BaseButton>
          </template>
        </EmptyState>

        <ul
          v-else
          class="access-list__rows"
          aria-label="Access keys"
        >
          <li
            v-for="accessKey in filteredAccessKeys"
            :key="accessKey.id"
          >
            <button
              class="access-row"
              :class="{ 'access-row--selected': accessKey.id === selectedId && editorMode !== 'create' }"
              type="button"
              :aria-current="accessKey.id === selectedId && editorMode !== 'create' ? 'true' : undefined"
              @click="selectAccessKey(accessKey.id)"
            >
              <span
                class="access-row__mark"
                :class="{ 'access-row__mark--disabled': !accessKey.enabled }"
                aria-hidden="true"
              >
                <KeyRound :size="18" />
              </span>
              <span class="access-row__primary">
                <strong>{{ accessKey.name }}</strong>
                <small class="mono"><Fingerprint
                  :size="13"
                  aria-hidden="true"
                />{{ accessKey.fingerprint }}</small>
              </span>
              <span class="access-row__meta">
                <StatusBadge
                  :label="accessKey.enabled ? 'Enabled' : 'Disabled'"
                  :tone="accessKey.enabled ? 'success' : 'neutral'"
                  :icon="accessKey.enabled ? Check : Pause"
                />
                <small>{{ scopeLabel(accessKey) }}</small>
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
        class="access-detail panel"
        aria-label="Access key details"
      >
        <AccessEditor
          v-if="editorMode === 'create'"
          mode="create"
          :assets="assets"
          :busy="mutationPending"
          v-bind="operationError ? { error: operationError } : {}"
          @cancel="closeEditor"
          @create="createAccessKey"
        />

        <AccessEditor
          v-else-if="editorMode === 'scope' && selectedAccessKey"
          mode="scope"
          :access-key="selectedAccessKey"
          :assets="assets"
          :busy="mutationPending"
          v-bind="operationError ? { error: operationError } : {}"
          @cancel="closeEditor"
          @update-scope="updateScope"
        />

        <template v-else-if="selectedAccessKey">
          <header class="access-detail__header">
            <span
              class="access-detail__mark"
              aria-hidden="true"
            ><KeyRound :size="21" /></span>
            <div>
              <h2>{{ selectedAccessKey.name }}</h2>
              <p class="mono">
                {{ selectedAccessKey.id }}
              </p>
            </div>
            <StatusBadge
              :label="selectedAccessKey.enabled ? 'Enabled' : 'Disabled'"
              :tone="selectedAccessKey.enabled ? 'success' : 'neutral'"
              :icon="selectedAccessKey.enabled ? Check : Pause"
            />
          </header>

          <InlineNotice
            v-if="selectedManagedSource"
            tone="warning"
            title="Declarative access key"
          >
            Source <strong>{{ selectedManagedSource }}</strong> owns this key. Edit its manifest to change state or scope.
          </InlineNotice>

          <section
            class="access-detail__fingerprint"
            aria-labelledby="access-fingerprint-heading"
          >
            <div>
              <Fingerprint
                :size="18"
                aria-hidden="true"
              />
              <h3 id="access-fingerprint-heading">
                Public-key fingerprint
              </h3>
            </div>
            <code>{{ selectedAccessKey.fingerprint }}</code>
            <p>This identifies the registered public key. Hop does not store or return its private key.</p>
          </section>

          <section
            class="access-detail__scope"
            aria-labelledby="access-scope-heading"
          >
            <div class="access-detail__section-heading">
              <div>
                <h3 id="access-scope-heading">
                  Asset access
                </h3>
                <p>Exactly what this ingress key can reach.</p>
              </div>
              <StatusBadge
                :label="scopeLabel(selectedAccessKey)"
                :tone="scopeTone(selectedAccessKey)"
                :icon="scopeIcon(selectedAccessKey)"
              />
            </div>

            <div
              v-if="selectedAccessKey.assetIds === null"
              class="access-detail__scope-summary"
            >
              <Globe2
                :size="19"
                aria-hidden="true"
              />
              <div>
                <strong>All Catalog assets</strong>
                <p>New assets are included automatically.</p>
              </div>
            </div>

            <div
              v-else-if="selectedAccessKey.assetIds.length === 0"
              class="access-detail__scope-summary access-detail__scope-summary--empty"
            >
              <Ban
                :size="19"
                aria-hidden="true"
              />
              <div>
                <strong>No asset access</strong>
                <p>The key remains registered but every target is denied.</p>
              </div>
            </div>

            <ul
              v-else
              class="access-detail__assets"
            >
              <li
                v-for="asset in selectedAssets"
                :key="asset.id"
              >
                <ShieldCheck
                  :size="16"
                  aria-hidden="true"
                />
                <span>{{ asset.name }}</span>
                <code>{{ asset.id }}</code>
              </li>
            </ul>
          </section>

          <footer class="access-detail__actions">
            <BaseButton
              variant="secondary"
              :loading="enabledMutation.isPending.value"
              :disabled="Boolean(selectedManagedSource) || !runtime.ready.value"
              @click="toggleEnabled"
            >
              <template #leading>
                <Pause v-if="selectedAccessKey.enabled" />
                <Play v-else />
              </template>
              {{ selectedAccessKey.enabled ? 'Disable key' : 'Enable key' }}
            </BaseButton>
            <BaseButton
              variant="secondary"
              :disabled="Boolean(selectedManagedSource) || !runtime.ready.value"
              @click="openScope"
            >
              <template #leading>
                <ListChecks />
              </template>
              Edit access
            </BaseButton>
            <BaseButton
              variant="quiet"
              :disabled="Boolean(selectedManagedSource) || !runtime.ready.value"
              @click="deleteOpen = true"
            >
              <template #leading>
                <Trash2 />
              </template>
              Delete
            </BaseButton>
          </footer>
        </template>

        <EmptyState
          v-else
          title="Select an access key"
          description="Choose a row to inspect its fingerprint, state, and asset scope."
          :icon="CircleDotDashed"
          compact
        />
      </aside>
    </section>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Delete access key?"
      :description="selectedAccessKey
        ? `${selectedAccessKey.name} will immediately lose ingress access to Hop.`
        : 'This access key will be deleted.'"
      confirm-label="Delete access key"
      :busy="deleteMutation.isPending.value"
      @confirm="deleteAccessKey"
    />
  </div>
</template>

<style scoped>
.access-page {
  --detail-width: minmax(330px, 0.78fr);
}

.access-page__intro-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.access-page__icon-button {
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

.access-page__icon-button:hover:not(:disabled) {
  color: var(--text-strong);
  border-color: var(--line-strong);
}

.access-page__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.is-spinning {
  animation: access-spin 800ms linear infinite;
}

.access-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--detail-width);
  gap: 12px;
  min-height: 560px;
}

.access-list,
.access-detail {
  min-width: 0;
  overflow: hidden;
}

.access-list__toolbar {
  display: flex;
  min-height: 60px;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}

.access-list__search {
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

.access-list__search:focus-within {
  border-color: var(--focus);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 24%, transparent);
}

.access-list__search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--text-strong);
  background: transparent;
}

.access-list__search input::placeholder {
  color: var(--text-muted);
}

.access-list__search button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 7px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}

.access-list__search button:hover {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.access-list__count {
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.access-list__rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.access-list__rows li + li {
  border-top: 1px solid var(--line);
}

.access-row {
  display: grid;
  grid-template-columns: 38px minmax(150px, 1fr) minmax(120px, auto) auto;
  gap: 11px;
  width: 100%;
  min-height: 68px;
  align-items: center;
  padding: 8px 12px;
  color: var(--text);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.access-row:hover {
  background: var(--surface-hover);
}

.access-row:focus-visible {
  position: relative;
  z-index: 1;
  outline-offset: -2px;
}

.access-row--selected {
  background: var(--surface-selected);
}

.access-row__mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 9px;
  color: var(--accent);
  background: var(--accent-soft);
}

.access-row__mark--disabled {
  color: var(--text-muted);
  background: var(--surface-raised);
}

.access-row__primary,
.access-row__meta {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.access-row__primary strong,
.access-row__primary small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-row__primary strong {
  color: var(--text-strong);
  font-size: 0.875rem;
}

.access-row__primary small {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.access-row__meta {
  justify-items: end;
}

.access-row__meta small {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.access-row > svg {
  color: var(--text-muted);
}

.access-list__loading {
  display: grid;
}

.access-list__loading span {
  height: 68px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(90deg, var(--surface-panel) 15%, var(--surface-raised) 48%, var(--surface-panel) 82%);
  background-size: 240% 100%;
  animation: access-shimmer 1.2s ease-in-out infinite;
}

.access-list__error {
  margin: 12px;
}

.access-detail {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 18px;
}

.access-detail__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 11px;
}

.access-detail__mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 10px;
  color: var(--accent);
  background: var(--accent-soft);
}

.access-detail__header h2 {
  margin: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-detail__header p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-detail__fingerprint,
.access-detail__scope {
  display: grid;
  gap: 10px;
}

.access-detail__fingerprint > div,
.access-detail__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.access-detail__fingerprint > div {
  justify-content: flex-start;
  color: var(--text-muted);
}

.access-detail__fingerprint h3,
.access-detail__scope h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 0.875rem;
}

.access-detail__fingerprint code {
  display: block;
  overflow: hidden;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  color: var(--text-strong);
  background: var(--surface-input);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-detail__fingerprint p,
.access-detail__section-heading p,
.access-detail__scope-summary p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.access-detail__section-heading > div p {
  margin-top: 2px;
}

.access-detail__scope-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  min-height: 64px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--info) 34%, var(--line));
  border-radius: 10px;
  color: var(--info);
  background: var(--info-soft);
}

.access-detail__scope-summary--empty {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 34%, var(--line));
  background: var(--warning-soft);
}

.access-detail__scope-summary strong {
  color: var(--text-strong);
  font-size: 0.8125rem;
}

.access-detail__assets {
  max-height: 212px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  list-style: none;
  overflow: auto;
}

.access-detail__assets li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, auto);
  gap: 9px;
  min-height: 48px;
  align-items: center;
  padding: 8px 11px;
}

.access-detail__assets li + li {
  border-top: 1px solid var(--line);
}

.access-detail__assets svg {
  color: var(--accent);
}

.access-detail__assets span,
.access-detail__assets code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-detail__assets span {
  color: var(--text-strong);
  font-size: 0.8125rem;
}

.access-detail__assets code {
  max-width: 120px;
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.access-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
}

@keyframes access-spin {
  to { transform: rotate(360deg); }
}

@keyframes access-shimmer {
  to { background-position: -140% 0; }
}

@media (max-width: 1120px) {
  .access-workspace {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
  }

  .access-row {
    grid-template-columns: 38px minmax(0, 1fr) auto;
  }

  .access-row__meta {
    display: none;
  }
}

@media (max-width: 820px) {
  .access-workspace {
    grid-template-columns: 1fr;
  }

  .access-detail {
    min-height: 380px;
  }
}

@media (max-width: 600px) {
  .access-page__intro {
    align-items: stretch;
  }

  .access-page__intro,
  .access-page__intro-actions {
    flex-direction: column;
  }

  .access-page__intro-actions {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .access-page__intro-actions :deep(.base-button) {
    width: 100%;
  }

  .access-detail__header {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .access-detail__header > :last-child {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .access-detail__actions {
    flex-direction: column;
  }

  .access-detail__actions :deep(.base-button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-spinning,
  .access-list__loading span {
    animation: none;
  }
}
</style>
