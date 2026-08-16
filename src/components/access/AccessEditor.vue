<script setup lang="ts">
import { Ban, Check, Globe2, KeyRound, ListChecks, ShieldCheck } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'

import { BaseButton, FormField, InlineNotice } from '@/components/ui'
import type { AccessKey, AccessKeyCreateInput, Asset } from '@/domain'
import { useI18n } from '@/i18n'
import { getPanelRuntimeConfig } from '@/api'

type ScopeChoice = 'all' | 'restricted' | 'empty'

const props = defineProps<{
  mode: 'create' | 'scope'
  accessKey?: AccessKey
  assets: Asset[]
  busy?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  cancel: []
  create: [input: AccessKeyCreateInput]
  updateScope: [assetIds: string[] | null]
}>()
const { t } = useI18n()
const isOpenWrt = getPanelRuntimeConfig().deployment === 'openwrt'

const form = reactive({
  name: '',
  publicKey: '',
})
const scopeChoice = ref<ScopeChoice>('all')
const selectedAssetIds = ref<string[]>([])
const fieldErrors = reactive<{ name?: string; publicKey?: string; assets?: string }>({})
const isManaged = computed(() => props.accessKey?.management?.mode === 'config')
const isScopeEdit = computed(() => props.mode === 'scope')
const sortedAssets = computed(() => [...props.assets].sort((left, right) => left.name.localeCompare(right.name)))

function reset() {
  form.name = ''
  form.publicKey = ''
  selectedAssetIds.value = props.accessKey?.assetIds ? [...props.accessKey.assetIds] : []
  scopeChoice.value =
    props.accessKey?.assetIds === null || props.accessKey === undefined
      ? 'all'
      : props.accessKey.assetIds.length === 0
        ? 'empty'
        : 'restricted'
  clearErrors()
}

function clearErrors() {
  delete fieldErrors.name
  delete fieldErrors.publicKey
  delete fieldErrors.assets
}

function chooseScope(choice: ScopeChoice) {
  scopeChoice.value = choice
  delete fieldErrors.assets
}

function toggleAsset(assetId: string) {
  if (selectedAssetIds.value.includes(assetId)) {
    selectedAssetIds.value = selectedAssetIds.value.filter((id) => id !== assetId)
  } else {
    selectedAssetIds.value = [...selectedAssetIds.value, assetId]
  }
  delete fieldErrors.assets
}

function resolvedAssetIds(): string[] | null {
  if (scopeChoice.value === 'all') return null
  if (scopeChoice.value === 'empty') return []
  return [...new Set(selectedAssetIds.value)].sort()
}

function validate() {
  clearErrors()
  if (!isScopeEdit.value && !form.name.trim()) {
    fieldErrors.name = t('Give this access key a recognizable name.')
  }
  if (!isScopeEdit.value && !form.publicKey.trim()) {
    fieldErrors.publicKey = t('Paste an OpenSSH public key.')
  }
  if (scopeChoice.value === 'restricted' && selectedAssetIds.value.length === 0) {
    fieldErrors.assets = t('Select at least one asset, or choose “No assets”.')
  }
  return Object.keys(fieldErrors).length === 0
}

function submit() {
  if (props.busy || isManaged.value || !validate()) return

  const assetIds = resolvedAssetIds()
  if (isScopeEdit.value) {
    emit('updateScope', assetIds)
    return
  }

  emit('create', {
    name: form.name.trim(),
    publicKey: form.publicKey.trim(),
    assetIds,
  })
}

watch(
  () => [props.mode, props.accessKey?.id] as const,
  reset,
  { immediate: true },
)
</script>

<template>
  <section
    class="access-editor"
    :aria-labelledby="`access-editor-${props.mode}`"
  >
    <header class="access-editor__header">
      <span
        class="access-editor__mark"
        aria-hidden="true"
      >
        <ListChecks
          v-if="isScopeEdit"
          :size="19"
        />
        <KeyRound
          v-else
          :size="19"
        />
      </span>
      <div>
        <h2 :id="`access-editor-${props.mode}`">
          {{ isScopeEdit ? t('Change asset access') : t('Add access key') }}
        </h2>
        <p>
          {{ isScopeEdit
            ? t('Choose exactly what {name} can reach.', { name: props.accessKey?.name ?? t('this key') })
            : t('Register an existing SSH public key and choose its initial Catalog scope.') }}
        </p>
      </div>
    </header>

    <InlineNotice
      v-if="isManaged"
      tone="warning"
      :title="t('Managed by configuration')"
    >
      {{ t(isOpenWrt ? 'OpenWrt config access editor explanation' : 'Config access editor explanation') }}
    </InlineNotice>

    <InlineNotice
      v-if="props.error"
      tone="danger"
      :title="isScopeEdit ? t('Access scope was not changed') : t('Access key was not added')"
    >
      {{ props.error }}
    </InlineNotice>

    <form
      class="access-editor__form"
      novalidate
      @submit.prevent="submit"
    >
      <template v-if="!isScopeEdit">
        <FormField
          :label="t('Name')"
          v-bind="fieldErrors.name ? { error: fieldErrors.name } : {}"
          required
        >
          <template #default="{ controlProps }">
            <input
              v-model="form.name"
              v-bind="controlProps"
              autocomplete="off"
              placeholder="oslo-laptop"
              :disabled="props.busy"
            >
          </template>
        </FormField>

        <FormField
          :label="t('OpenSSH public key')"
          v-bind="fieldErrors.publicKey ? { error: fieldErrors.publicKey } : {}"
          :hint="t('Paste the complete ssh-ed25519, ecdsa, or rsa public-key line.')"
          required
        >
          <template #default="{ controlProps }">
            <textarea
              v-model="form.publicKey"
              v-bind="controlProps"
              class="access-editor__public-key"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              placeholder="ssh-ed25519 AAAAC3… operator@device"
              :disabled="props.busy"
            />
          </template>
        </FormField>

        <InlineNotice
          tone="info"
          :title="t('Public key only')"
        >
          {{ t('Public key derivation explanation') }}
        </InlineNotice>
      </template>

      <fieldset
        class="access-editor__scope"
        :disabled="props.busy || isManaged"
      >
        <legend>{{ t('Asset scope') }}</legend>

        <button
          class="access-editor__scope-option"
          :class="{ 'access-editor__scope-option--selected': scopeChoice === 'all' }"
          type="button"
          role="radio"
          :aria-checked="scopeChoice === 'all'"
          @click="chooseScope('all')"
        >
          <span
            class="access-editor__scope-icon"
            aria-hidden="true"
          ><Globe2 :size="18" /></span>
          <span>
            <strong>{{ t('All assets') }}</strong>
            <small>{{ t('Includes assets added later.') }}</small>
          </span>
          <Check
            v-if="scopeChoice === 'all'"
            :size="17"
            aria-hidden="true"
          />
        </button>

        <button
          class="access-editor__scope-option"
          :class="{ 'access-editor__scope-option--selected': scopeChoice === 'restricted' }"
          type="button"
          role="radio"
          :aria-checked="scopeChoice === 'restricted'"
          @click="chooseScope('restricted')"
        >
          <span
            class="access-editor__scope-icon"
            aria-hidden="true"
          ><ListChecks :size="18" /></span>
          <span>
            <strong>{{ t('Selected assets') }}</strong>
            <small>{{ t('Only the checked targets below.') }}</small>
          </span>
          <Check
            v-if="scopeChoice === 'restricted'"
            :size="17"
            aria-hidden="true"
          />
        </button>

        <button
          class="access-editor__scope-option"
          :class="{ 'access-editor__scope-option--selected': scopeChoice === 'empty' }"
          type="button"
          role="radio"
          :aria-checked="scopeChoice === 'empty'"
          @click="chooseScope('empty')"
        >
          <span
            class="access-editor__scope-icon"
            aria-hidden="true"
          ><Ban :size="18" /></span>
          <span>
            <strong>{{ t('No assets') }}</strong>
            <small>{{ t('Keep the key registered without target access.') }}</small>
          </span>
          <Check
            v-if="scopeChoice === 'empty'"
            :size="17"
            aria-hidden="true"
          />
        </button>
      </fieldset>

      <div
        v-if="scopeChoice === 'restricted'"
        class="access-editor__assets"
        :aria-invalid="fieldErrors.assets ? 'true' : undefined"
      >
        <p
          v-if="sortedAssets.length === 0"
          class="access-editor__assets-empty"
        >
          {{ t('No assets are available. Choose “No assets” until the Catalog has a target.') }}
        </p>
        <label
          v-for="asset in sortedAssets"
          :key="asset.id"
          class="access-editor__asset"
        >
          <input
            type="checkbox"
            :checked="selectedAssetIds.includes(asset.id)"
            :disabled="props.busy || isManaged"
            @change="toggleAsset(asset.id)"
          >
          <span>
            <strong>{{ asset.name }}</strong>
            <small class="mono">{{ asset.hostname }}:{{ asset.port }}</small>
          </span>
          <span class="access-editor__protocol">{{ asset.protocol.toUpperCase() }}</span>
        </label>
        <p
          v-if="fieldErrors.assets"
          class="access-editor__error"
          role="alert"
        >
          {{ fieldErrors.assets }}
        </p>
      </div>

      <div class="access-editor__boundary">
        <ShieldCheck
          :size="17"
          aria-hidden="true"
        />
        <span>{{ t('Scope is enforced by the Catalog. An empty restricted set is an explicit deny-all state.') }}</span>
      </div>

      <footer class="access-editor__actions">
        <BaseButton
          variant="quiet"
          :disabled="props.busy"
          @click="emit('cancel')"
        >
          {{ t('Cancel') }}
        </BaseButton>
        <BaseButton
          variant="primary"
          type="submit"
          :loading="props.busy"
          :disabled="isManaged"
          :loading-label="isScopeEdit ? t('Saving asset access') : t('Adding access key')"
        >
          {{ isScopeEdit ? t('Save access') : t('Add public key') }}
        </BaseButton>
      </footer>
    </form>
  </section>
</template>

<style scoped>
.access-editor {
  display: grid;
  gap: 18px;
}

.access-editor__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.access-editor__mark {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 10px;
  color: var(--accent);
  background: var(--accent-soft);
}

.access-editor__mark :deep(svg) {
  stroke-width: 1.8;
}

.access-editor h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.access-editor__header p {
  max-width: 52ch;
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.access-editor__form {
  display: grid;
  gap: 14px;
}

.access-editor__public-key {
  min-height: 104px !important;
  font-family: var(--font-mono);
  line-height: 1.45;
}

.access-editor__scope {
  display: grid;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.access-editor__scope legend {
  margin-bottom: 7px;
  color: var(--text-strong);
  font-size: 0.8125rem;
  font-weight: 650;
}

.access-editor__scope-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 56px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  color: var(--text);
  text-align: left;
  background: var(--surface-input);
  cursor: pointer;
}

.access-editor__scope-option:hover:not(:disabled) {
  border-color: var(--line-strong);
  background: var(--surface-hover);
}

.access-editor__scope-option:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.access-editor__scope-option--selected {
  border-color: color-mix(in srgb, var(--accent) 54%, var(--line));
  background: var(--accent-soft);
}

.access-editor__scope-option > span:nth-child(2) {
  display: grid;
  gap: 2px;
}

.access-editor__scope-option strong {
  color: var(--text-strong);
  font-size: 0.8125rem;
}

.access-editor__scope-option small {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.access-editor__scope-option > svg {
  color: var(--accent);
}

.access-editor__scope-icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--surface-raised);
}

.access-editor__assets {
  display: grid;
  max-height: 258px;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: auto;
}

.access-editor__asset {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  min-height: 52px;
  align-items: center;
  padding-right: 12px;
  cursor: pointer;
}

.access-editor__asset + .access-editor__asset {
  border-top: 1px solid var(--line);
}

.access-editor__asset:hover {
  background: var(--surface-hover);
}

.access-editor__asset input {
  width: 16px;
  height: 16px;
  margin: 0 auto;
  accent-color: var(--accent);
}

.access-editor__asset > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.access-editor__asset strong,
.access-editor__asset small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-editor__asset strong {
  color: var(--text-strong);
  font-size: 0.8125rem;
}

.access-editor__asset small {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.access-editor__protocol {
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 700;
}

.access-editor__assets-empty,
.access-editor__error {
  margin: 0;
  padding: 12px;
  font-size: 0.75rem;
}

.access-editor__assets-empty {
  color: var(--text-muted);
}

.access-editor__error {
  border-top: 1px solid color-mix(in srgb, var(--danger) 32%, var(--line));
  color: var(--danger);
  background: var(--danger-soft);
}

.access-editor__boundary {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.access-editor__boundary svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--accent);
}

.access-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

@media (max-width: 520px) {
  .access-editor__actions {
    flex-direction: column-reverse;
  }

  .access-editor__actions :deep(.base-button) {
    width: 100%;
  }
}
</style>
