<script setup lang="ts">
/* global HTMLDialogElement */

import {
  Archive,
  Boxes,
  CircleDot,
  Filter,
  Pencil,
  Plus,
  Search,
  Server,
  Trash2,
  X,
} from '@lucide/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'

import { BaseButton, ConfirmDialog, EmptyState, InlineNotice, StatusBadge } from '@/components/ui'
import type { Asset, AssetProtocol, AssetWriteInput } from '@/domain'
import {
  useAssetsQuery,
  useCreateAssetMutation,
  useCredentialsQuery,
  useDeleteAssetMutation,
  useHopApiRuntime,
  useUpdateAssetMutation,
} from '@/queries'
import { formatTimestamp } from '@/utils/format'

const assetSchema = z.object({
  name: z.string().trim().min(1, 'Enter a resource name.'),
  protocol: z.enum(['ssh', 'tcp']),
  hostname: z.string().trim().min(1, 'Enter a hostname or IP address.'),
  port: z.coerce.number().int().min(1, 'Port must be at least 1.').max(65_535, 'Port must be 65535 or lower.'),
  description: z.string(),
  tags: z.string(),
  credentialId: z.string(),
})

const route = useRoute()
const router = useRouter()
const runtime = useHopApiRuntime()
const assetsQuery = useAssetsQuery()
const credentialsQuery = useCredentialsQuery()
const createMutation = useCreateAssetMutation()
const updateMutation = useUpdateAssetMutation()
const deleteMutation = useDeleteAssetMutation()

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const protocol = ref<'all' | AssetProtocol>(
  route.query.protocol === 'ssh' || route.query.protocol === 'tcp' ? route.query.protocol : 'all',
)
const ownership = ref<'all' | 'local' | 'declarative'>('all')
const credentialState = ref<'all' | 'configured' | 'missing'>('all')
const editor = ref<HTMLDialogElement | null>(null)
const editorOpen = ref(false)
const editingAsset = ref<Asset | null>(null)
const deleteOpen = ref(false)
const feedback = ref('')
const fieldErrors = ref<Record<string, string>>({})
const selectionOpenedHere = ref(false)

const form = reactive({
  name: '',
  protocol: 'ssh' as AssetProtocol,
  hostname: '',
  port: 22,
  description: '',
  tags: '',
  credentialId: '',
})

const selectedId = computed(() => (typeof route.query.asset === 'string' ? route.query.asset : null))
const selectedAsset = computed(
  () => assetsQuery.data.value?.find((asset) => asset.id === selectedId.value) ?? null,
)
const hasOwnership = computed(() => runtime.capabilities.value?.ownership === true)

const filteredAssets = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return (assetsQuery.data.value ?? []).filter((asset) => {
    const matchesSearch =
      needle === '' ||
      [asset.name, asset.hostname, asset.description ?? '', ...asset.tags]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    const matchesProtocol = protocol.value === 'all' || asset.protocol === protocol.value
    const matchesOwnership =
      ownership.value === 'all' || asset.management?.mode === ownership.value
    const hasCredential = asset.protocol === 'tcp' || asset.credentialId !== null
    const matchesCredential =
      credentialState.value === 'all' ||
      (credentialState.value === 'configured' ? hasCredential : !hasCredential)
    return matchesSearch && matchesProtocol && matchesOwnership && matchesCredential
  })
})

const counts = computed(() => ({
  all: assetsQuery.data.value?.length ?? 0,
  ssh: assetsQuery.data.value?.filter((asset) => asset.protocol === 'ssh').length ?? 0,
  tcp: assetsQuery.data.value?.filter((asset) => asset.protocol === 'tcp').length ?? 0,
  local: assetsQuery.data.value?.filter((asset) => asset.management?.mode === 'local').length ?? 0,
  declarative: assetsQuery.data.value?.filter((asset) => asset.management?.mode === 'declarative').length ?? 0,
}))

function credentialName(asset: Asset) {
  if (asset.protocol === 'tcp') return 'Not used'
  if (asset.credentialId === null) return 'Missing'
  return credentialsQuery.data.value?.find((credential) => credential.id === asset.credentialId)?.name ?? 'Configured'
}

function ownershipLabel(asset: Asset) {
  return asset.management?.mode === 'declarative'
    ? `Source · ${asset.management.sourceId}`
    : 'Local'
}

function setSelection(id: string | null) {
  const query = { ...route.query }
  if (id === null) {
    delete query.asset
    if (selectionOpenedHere.value) {
      selectionOpenedHere.value = false
      router.back()
    } else {
      void router.replace({ query })
    }
    return
  }

  query.asset = id
  if (selectedId.value === null) {
    selectionOpenedHere.value = true
    void router.push({ query })
  } else {
    void router.replace({ query })
  }
}

function clearFilters() {
  search.value = ''
  protocol.value = 'all'
  ownership.value = 'all'
  credentialState.value = 'all'
}

function openCreate() {
  editingAsset.value = null
  Object.assign(form, {
    name: '',
    protocol: 'ssh',
    hostname: '',
    port: 22,
    description: '',
    tags: '',
    credentialId: '',
  })
  fieldErrors.value = {}
  feedback.value = ''
  editorOpen.value = true
}

function openEdit(asset: Asset) {
  editingAsset.value = asset
  Object.assign(form, {
    name: asset.name,
    protocol: asset.protocol,
    hostname: asset.hostname,
    port: asset.port,
    description: asset.description ?? '',
    tags: asset.tags.join(', '),
    credentialId: asset.credentialId ?? '',
  })
  fieldErrors.value = {}
  feedback.value = ''
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
}

async function submitAsset() {
  feedback.value = ''
  const result = assetSchema.safeParse(form)
  if (!result.success) {
    const flattened = result.error.flatten().fieldErrors
    fieldErrors.value = Object.fromEntries(
      Object.entries(flattened)
        .filter(([, messages]) => messages?.[0])
        .map(([key, messages]) => [key, messages?.[0] ?? 'Invalid value']),
    )
    return
  }

  fieldErrors.value = {}
  const input: AssetWriteInput = {
    name: result.data.name,
    protocol: result.data.protocol,
    hostname: result.data.hostname,
    port: result.data.port,
    description: result.data.description.trim() || null,
    tags: result.data.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    credentialId: result.data.protocol === 'ssh' ? result.data.credentialId || null : null,
  }

  try {
    const saved = editingAsset.value
      ? await updateMutation.mutateAsync({ id: editingAsset.value.id, input })
      : await createMutation.mutateAsync(input)
    closeEditor()
    setSelection(saved.id)
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'The asset could not be saved.'
  }
}

async function confirmDelete() {
  if (selectedAsset.value === null) return
  feedback.value = ''
  try {
    await deleteMutation.mutateAsync(selectedAsset.value.id)
    deleteOpen.value = false
    setSelection(null)
  } catch (error) {
    deleteOpen.value = false
    feedback.value = error instanceof Error ? error.message : 'The asset could not be removed.'
  }
}

watch(editorOpen, async (open) => {
  await nextTick()
  if (open && !editor.value?.open) editor.value?.showModal()
  if (!open && editor.value?.open) editor.value.close()
})

watch(
  () => form.protocol,
  (value) => {
    if (value === 'tcp') form.credentialId = ''
    if (!editingAsset.value) form.port = value === 'ssh' ? 22 : 443
  },
)

watch([search, protocol], () => {
  const query = { ...route.query }
  if (search.value.trim()) query.q = search.value.trim()
  else delete query.q
  if (protocol.value !== 'all') query.protocol = protocol.value
  else delete query.protocol
  void router.replace({ query })
})

</script>

<template>
  <section class="assets-page page-stack">
    <InlineNotice v-if="feedback" tone="danger" title="Asset action was not completed">
      <p>{{ feedback }}</p>
    </InlineNotice>

    <div class="assets-workspace panel" :class="{ 'has-selection': selectedAsset }">
      <aside class="asset-context" aria-label="Asset filters">
        <header>
          <span>Assets</span>
          <BaseButton variant="quiet" aria-label="Create asset" @click="openCreate"><template #leading><Plus /></template></BaseButton>
        </header>
        <button :class="{ active: protocol === 'all' }" type="button" @click="protocol = 'all'">All assets <span>{{ counts.all }}</span></button>
        <button :class="{ active: protocol === 'ssh' }" type="button" @click="protocol = 'ssh'">SSH <span>{{ counts.ssh }}</span></button>
        <button :class="{ active: protocol === 'tcp' }" type="button" @click="protocol = 'tcp'">TCP <span>{{ counts.tcp }}</span></button>
        <template v-if="hasOwnership">
          <div class="context-seam" />
          <small class="ownership-heading"><span>Ownership</span><em>Demo-only · synthetic</em></small>
          <button :class="{ active: ownership === 'local' }" type="button" @click="ownership = ownership === 'local' ? 'all' : 'local'">Local <span>{{ counts.local }}</span></button>
          <button :class="{ active: ownership === 'declarative' }" type="button" @click="ownership = ownership === 'declarative' ? 'all' : 'declarative'">Declarative <span>{{ counts.declarative }}</span></button>
        </template>
      </aside>

      <section class="asset-inventory">
        <header class="asset-toolbar">
          <label class="search-control">
            <Search :size="18" aria-hidden="true" />
            <span class="sr-only">Search assets</span>
            <input v-model="search" type="search" placeholder="Search assets…" />
          </label>
          <label class="compact-select"><span class="sr-only">Protocol</span><select v-model="protocol"><option value="all">All protocols</option><option value="ssh">SSH</option><option value="tcp">TCP</option></select></label>
          <label class="compact-select"><span class="sr-only">Credential status</span><select v-model="credentialState"><option value="all">Any credential</option><option value="configured">Configured</option><option value="missing">Missing</option></select></label>
          <label v-if="hasOwnership" class="compact-select owner-select"><span class="sr-only">Ownership</span><select v-model="ownership"><option value="all">Any owner</option><option value="local">Local</option><option value="declarative">Declarative</option></select></label>
          <BaseButton variant="primary" @click="openCreate"><template #leading><Plus /></template>New asset</BaseButton>
        </header>

        <div class="asset-table" :class="{ 'no-ownership': !hasOwnership }" role="table" aria-label="Catalog assets">
          <div class="asset-head" role="row">
            <span role="columnheader">Name</span><span role="columnheader">Protocol</span><span role="columnheader">Address</span><span role="columnheader">Credential</span><span v-if="hasOwnership" role="columnheader">Ownership</span>
          </div>

          <button
            v-for="asset in filteredAssets"
            :key="asset.id"
            type="button"
            class="asset-row"
            :class="{ selected: asset.id === selectedId }"
            :aria-pressed="asset.id === selectedId"
            @click="setSelection(asset.id)"
          >
            <span class="asset-name" role="cell">
              <span class="protocol-icon" aria-hidden="true"><Server v-if="asset.protocol === 'ssh'" :size="15" /><Boxes v-else :size="15" /></span>
              <span><strong>{{ asset.name }}</strong><small>{{ asset.description || asset.tags.join(' · ') || 'No description' }}</small></span>
            </span>
            <span role="cell"><StatusBadge :label="asset.protocol.toUpperCase()" tone="neutral" /></span>
            <span class="mono address" role="cell">{{ asset.hostname }}:{{ asset.port }}</span>
            <span class="credential-cell" :class="{ missing: asset.protocol === 'ssh' && !asset.credentialId }" role="cell"><CircleDot :size="13" aria-hidden="true" />{{ credentialName(asset) }}</span>
            <span v-if="hasOwnership" role="cell"><StatusBadge :label="ownershipLabel(asset)" :tone="asset.management?.mode === 'declarative' ? 'info' : 'neutral'" /></span>
          </button>

          <EmptyState v-if="!assetsQuery.isPending.value && filteredAssets.length === 0" :compact="true" title="No matching assets" description="Clear filters or add a local SSH or TCP target.">
            <template #actions><BaseButton variant="secondary" @click="clearFilters"><template #leading><Filter /></template>Clear filters</BaseButton></template>
          </EmptyState>
          <div v-if="assetsQuery.isPending.value" class="loading-rows" aria-label="Loading assets" aria-busy="true"><span /><span /><span /><span /></div>
        </div>

        <footer class="inventory-footer"><span>{{ filteredAssets.length }} of {{ counts.all }} assets</span><span v-if="!hasOwnership">Ownership metadata is not exposed by this API</span></footer>
      </section>

      <aside v-if="selectedAsset" class="asset-inspector" aria-label="Selected asset">
        <header class="inspector-heading">
          <span class="inspector-icon" aria-hidden="true"><Server v-if="selectedAsset.protocol === 'ssh'" :size="20" /><Boxes v-else :size="20" /></span>
          <div><h2>{{ selectedAsset.name }}</h2><p>{{ selectedAsset.protocol.toUpperCase() }} asset</p></div>
          <button class="close-inspector" type="button" aria-label="Close asset details" @click="setSelection(null)"><X :size="18" /></button>
        </header>

        <dl class="inspector-fields">
          <div><dt>Protocol</dt><dd>{{ selectedAsset.protocol.toUpperCase() }}</dd></div>
          <div><dt>Address</dt><dd class="mono">{{ selectedAsset.hostname }}:{{ selectedAsset.port }}</dd></div>
          <div><dt>Credential</dt><dd>{{ credentialName(selectedAsset) }}</dd></div>
          <div v-if="hasOwnership" class="ownership-field"><dt>Ownership</dt><dd>{{ ownershipLabel(selectedAsset) }}<small>Demo-only · synthetic</small></dd></div>
          <div><dt>Updated</dt><dd>{{ formatTimestamp(selectedAsset.updatedAt) }}</dd></div>
          <div v-if="selectedAsset.tags.length"><dt>Tags</dt><dd class="tag-list"><span v-for="tag in selectedAsset.tags" :key="tag">{{ tag }}</span></dd></div>
        </dl>

        <InlineNotice v-if="selectedAsset.management?.mode === 'declarative'" tone="info" title="Managed by a configuration source">
          <p>Edit source <strong>{{ selectedAsset.management.sourceId }}</strong> and apply a new manifest revision.</p>
        </InlineNotice>
        <InlineNotice v-else-if="!hasOwnership" tone="neutral">
          <p>This API does not expose ownership before a write. If a source owns this asset, Hop will reject the action safely.</p>
        </InlineNotice>

        <section class="inspector-actions">
          <h3>Actions</h3>
          <BaseButton variant="secondary" :disabled="selectedAsset.management?.mode === 'declarative'" @click="openEdit(selectedAsset)"><template #leading><Pencil /></template>Edit asset</BaseButton>
          <BaseButton variant="danger" :disabled="selectedAsset.management?.mode === 'declarative'" @click="deleteOpen = true"><template #leading><Trash2 /></template>Remove asset</BaseButton>
        </section>
      </aside>

      <div v-else class="asset-inspector inspector-empty" aria-hidden="true">
        <Archive :size="25" /><p>Select an asset to inspect its Catalog record.</p>
      </div>
    </div>

    <dialog ref="editor" class="asset-editor" @close="editorOpen = false" @cancel.prevent="closeEditor">
      <form class="editor-form" @submit.prevent="submitAsset">
        <header><div><h2>{{ editingAsset ? 'Edit asset' : 'New asset' }}</h2><p>{{ editingAsset ? 'Update the local Catalog record.' : 'Add an SSH or TCP target to the local Catalog.' }}</p></div><button type="button" aria-label="Close editor" @click="closeEditor"><X :size="19" /></button></header>
        <InlineNotice v-if="feedback" tone="danger"><p>{{ feedback }}</p></InlineNotice>
        <div class="form-grid">
          <label><span>Name</span><input v-model="form.name" autocomplete="off" :aria-invalid="Boolean(fieldErrors.name)" /><small v-if="fieldErrors.name">{{ fieldErrors.name }}</small></label>
          <label><span>Protocol</span><select v-model="form.protocol"><option value="ssh">SSH</option><option value="tcp">TCP</option></select></label>
          <label class="host-field"><span>Hostname or IP</span><input v-model="form.hostname" spellcheck="false" :aria-invalid="Boolean(fieldErrors.hostname)" /><small v-if="fieldErrors.hostname">{{ fieldErrors.hostname }}</small></label>
          <label><span>Port</span><input v-model.number="form.port" type="number" min="1" max="65535" :aria-invalid="Boolean(fieldErrors.port)" /><small v-if="fieldErrors.port">{{ fieldErrors.port }}</small></label>
          <label v-if="form.protocol === 'ssh'" class="wide-field"><span>Credential</span><select v-model="form.credentialId"><option value="">No credential</option><option v-for="credential in credentialsQuery.data.value ?? []" :key="credential.id" :value="credential.id">{{ credential.name }} · {{ credential.username }}</option></select></label>
          <label class="wide-field"><span>Tags</span><input v-model="form.tags" placeholder="production, edge" /><small>Comma-separated labels.</small></label>
          <label class="wide-field"><span>Description</span><textarea v-model="form.description" rows="3" /></label>
        </div>
        <footer><BaseButton variant="secondary" @click="closeEditor">Cancel</BaseButton><BaseButton variant="primary" type="submit" :loading="createMutation.isPending.value || updateMutation.isPending.value"><template #leading><Plus /></template>{{ editingAsset ? 'Save changes' : 'Create asset' }}</BaseButton></footer>
      </form>
    </dialog>

    <ConfirmDialog v-model:open="deleteOpen" title="Remove this asset?" :description="selectedAsset ? `${selectedAsset.name} will be deleted from the local Catalog. This cannot be undone.` : ''" confirm-label="Remove asset" :busy="deleteMutation.isPending.value" @confirm="confirmDelete" />
  </section>
</template>

<style scoped>
.assets-workspace {
  display: grid;
  min-height: calc(100vh - 119px);
  grid-template-columns: 190px minmax(520px, 1fr) 320px;
  overflow: hidden;
}

.asset-context,
.asset-inspector {
  min-width: 0;
  background: color-mix(in srgb, var(--surface-panel) 72%, var(--surface-canvas));
}

.asset-context {
  padding: 14px 10px;
  border-right: 1px solid var(--line);
}

.asset-context header {
  display: flex;
  height: 48px;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 8px 12px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.asset-context header :deep(.base-button) {
  width: 40px;
  min-height: 40px;
  padding: 0;
}

.asset-context > button {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  padding: 0 11px;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.asset-context > button:hover,
.asset-context > button.active {
  background: var(--surface-selected);
  color: var(--text-strong);
}

.asset-context > button span,
.asset-context > small {
  color: var(--text-muted);
}

.asset-context > small {
  display: block;
  padding: 7px 12px;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.asset-context > .ownership-heading {
  display: grid;
  gap: 3px;
}

.ownership-heading em,
.ownership-field small {
  color: var(--accent-strong);
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.context-seam {
  height: 1px;
  margin: 14px 8px;
  background: var(--line);
}

.asset-inventory {
  display: grid;
  min-width: 0;
  grid-template-rows: auto 1fr auto;
}

.asset-toolbar {
  display: flex;
  min-height: 70px;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}

.search-control {
  display: flex;
  min-width: 190px;
  flex: 1;
  height: 44px;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-input);
  color: var(--text-muted);
}

.search-control:focus-within {
  border-color: var(--focus);
}

.search-control input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
}

.compact-select select {
  height: 44px;
  padding: 0 32px 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-input);
}

.owner-select {
  display: none;
}

.asset-table {
  min-width: 0;
  overflow: auto;
}

.asset-head,
.asset-row {
  display: grid;
  min-width: 760px;
  grid-template-columns: minmax(190px, 1.35fr) 92px minmax(150px, 1fr) minmax(130px, 0.8fr) minmax(120px, 0.85fr);
  align-items: center;
  gap: 10px;
  padding: 0 16px;
}

.asset-head.no-ownership,
.asset-row.no-ownership,
.asset-table.no-ownership .asset-head,
.asset-table.no-ownership .asset-row {
  min-width: 640px;
  grid-template-columns: minmax(190px, 1.4fr) 92px minmax(150px, 1fr) minmax(130px, 0.9fr);
}

.asset-head {
  min-height: 42px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}

.asset-row {
  width: 100%;
  min-height: 59px;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.asset-row:hover {
  background: var(--surface-hover);
}

.asset-row.selected {
  background: var(--surface-selected);
  box-shadow: inset 2px 0 var(--accent);
}

.asset-row > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.asset-name > span:last-child {
  display: grid;
  min-width: 0;
}

.asset-name strong {
  overflow: hidden;
  color: var(--text-strong);
  font-weight: 600;
  text-overflow: ellipsis;
}

.asset-name small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
}

.protocol-icon,
.inspector-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  color: var(--text-muted);
}

.credential-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-strong);
}

.credential-cell.missing {
  color: var(--warning);
}

.loading-rows {
  display: grid;
}

.loading-rows span {
  height: 59px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-raised) 50%, transparent);
  animation: loading-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes loading-pulse { to { opacity: 0.45; } }

.inventory-footer {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px;
  border-top: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 12px;
}

.asset-inspector {
  padding: 20px 18px;
  border-left: 1px solid var(--line);
}

.inspector-heading {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
}

.inspector-heading h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 650;
}

.inspector-heading p {
  margin: 2px 0 0;
  color: var(--text-muted);
}

.close-inspector,
.editor-form header > button {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.close-inspector:hover,
.editor-form header > button:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.inspector-fields {
  display: grid;
  margin: 0;
  padding: 14px 0;
}

.inspector-fields > div {
  display: grid;
  grid-template-columns: 95px minmax(0, 1fr);
  gap: 10px;
  min-height: 46px;
  align-items: center;
}

.inspector-fields dt {
  color: var(--text-muted);
}

.inspector-fields dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-strong);
}

.ownership-field dd {
  display: grid;
  gap: 3px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag-list span {
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text);
  font-size: 11px;
}

.inspector-actions {
  display: grid;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.inspector-actions h3 {
  margin: 0 0 5px;
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.inspector-actions :deep(.base-button) {
  width: 100%;
  justify-content: flex-start;
}

.inspector-actions :deep(.base-button--danger) {
  border: 1px solid color-mix(in srgb, var(--danger) 55%, var(--line));
  background: transparent;
  color: var(--danger);
}

.inspector-actions :deep(.base-button--danger:not(:disabled):hover) {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.inspector-empty {
  display: grid;
  align-content: center;
  justify-items: center;
  color: var(--text-muted);
  pointer-events: none;
  text-align: center;
}

.inspector-empty p {
  max-width: 24ch;
}

.asset-editor {
  width: min(620px, calc(100vw - 28px));
  max-height: calc(100dvh - 28px);
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  background: var(--surface-panel);
  color: var(--text);
  box-shadow: var(--shadow-layer);
}

.asset-editor::backdrop { background: rgba(3, 8, 14, 0.7); backdrop-filter: blur(4px); }

.editor-form { display: grid; gap: 20px; padding: 22px; }
.editor-form header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.editor-form h2 { margin: 0; color: var(--text-strong); font-size: 20px; }
.editor-form header p { margin: 3px 0 0; color: var(--text-muted); }
.form-grid { display: grid; grid-template-columns: minmax(0, 1fr) 132px; gap: 14px; }
.form-grid label { display: grid; align-content: start; gap: 6px; }
.form-grid label > span { color: var(--text-strong); font-size: 12px; font-weight: 650; }
.form-grid input, .form-grid select, .form-grid textarea { width: 100%; min-height: 44px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; outline: 0; background: var(--surface-input); }
.form-grid input:focus, .form-grid select:focus, .form-grid textarea:focus { border-color: var(--focus); }
.form-grid textarea { resize: vertical; }
.form-grid small { color: var(--text-muted); }
.form-grid [aria-invalid='true'] + small { color: var(--danger); }
.host-field, .wide-field { grid-column: span 1; }
.wide-field { grid-column: 1 / -1; }
.editor-form footer { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 1535px) {
  .assets-workspace { grid-template-columns: minmax(520px, 1fr) 320px; }
  .asset-context { display: none; }
  .owner-select { display: block; }
}

@media (max-width: 1350px) and (min-width: 900px) {
  .owner-select { display: none; }
}

@media (max-width: 1199px) {
  .assets-workspace { grid-template-columns: 1fr; }
  .asset-inspector { position: fixed; inset: 68px 0 0 auto; z-index: 25; width: min(380px, calc(100vw - 76px)); overflow: auto; border-top: 1px solid var(--line); box-shadow: var(--shadow-layer); }
  .inspector-empty { display: none; }
}

@media (max-width: 899px) {
  .assets-workspace { min-height: calc(100dvh - 138px); }
  .assets-workspace.has-selection .asset-inventory { visibility: hidden; }
  .asset-toolbar { flex-wrap: wrap; padding: 10px; }
  .search-control { flex-basis: calc(100% - 52px); }
  .asset-toolbar :deep(.base-button) { width: 44px; padding: 0; font-size: 0; }
  .compact-select { flex: 1; }
  .compact-select select { width: 100%; }
  .owner-select { display: none; }
  .asset-head { display: none; }
  .asset-table, .asset-table.no-ownership { overflow: visible; }
  .asset-row, .asset-table.no-ownership .asset-row { min-width: 0; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto; gap: 5px 12px; padding: 10px 12px; }
  .asset-row > :nth-child(2) { grid-column: 2; grid-row: 1; }
  .asset-row .address { grid-column: 1; grid-row: 2; padding-left: 40px; color: var(--text-muted); font-size: 12px; }
  .asset-row .credential-cell { grid-column: 2; grid-row: 2; font-size: 11px; }
  .asset-row > :nth-child(5) { display: none; }
  .inventory-footer span:last-child { display: none; }
  .asset-inspector { inset: 58px 0 calc(64px + env(safe-area-inset-bottom)); width: 100%; border: 0; background: var(--surface-canvas); box-shadow: none; }
  .form-grid { grid-template-columns: 1fr 110px; }
}

@media (max-width: 520px) {
  .form-grid { grid-template-columns: 1fr; }
  .host-field, .wide-field { grid-column: 1; }
  .editor-form footer { display: grid; grid-template-columns: 1fr; }
  .editor-form footer :deep(.base-button) { width: 100%; }
}
</style>
