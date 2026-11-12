<script setup lang="ts">
/* global HTMLDialogElement, HTMLInputElement, HTMLElement, KeyboardEvent, navigator, window, setTimeout, clearTimeout */

import {
  Activity,
  Boxes,
  Check,
  CircleDot,
  Copy,
  Filter,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Server,
  SquareTerminal,
  Trash2,
  X,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'

import { getPanelRuntimeConfig } from '@/api'
import BootstrapKeyDialog from '@/components/assets/BootstrapKeyDialog.vue'
import SshConfigDialog from '@/components/assets/SshConfigDialog.vue'
import { BaseButton, ConfirmDialog, EmptyState, InlineNotice, StatusBadge } from '@/components/ui'
import type {
  Asset,
  AssetProtocol,
  AssetWriteInput,
  CredentialAuthType,
  CredentialWriteInput,
} from '@/domain'
import { useI18n } from '@/i18n'
import {
  useAllProbeHistoryQuery,
  useAssetsQuery,
  useCreateAssetMutation,
  useCreateCredentialMutation,
  useCredentialsQuery,
  useDeleteAssetMutation,
  useHopApiRuntime,
  useProbeAssetMutation,
  useProbeAssetsMutation,
  useUpdateAssetMutation,
} from '@/queries'
import { useConnection } from '@/stores/connection'
import { formatRelativeTime, formatTimestamp } from '@/utils/format'
import {
  buildAssetConnectCommand,
  inferDefaultHopHost,
  parseSshListenPort,
} from '@/utils/ssh-config'

const assetSchema = z.object({
  name: z.string().trim().min(1, 'Enter a resource name.'),
  protocol: z.enum(['ssh', 'tcp']),
  hostname: z.string().trim().min(1, 'Enter a hostname or IP address.'),
  port: z.coerce
    .number()
    .int()
    .min(1, 'Port must be at least 1.')
    .max(65_535, 'Port must be 65535 or lower.'),
  displayName: z.string(),
  description: z.string(),
  tags: z.string(),
  credentialId: z.string(),
})

type HealthFilter = 'all' | 'healthy' | 'failed' | 'unknown'
type CredentialFormMode = 'existing' | 'inline'

const route = useRoute()
const router = useRouter()
const runtime = useHopApiRuntime()
const connection = useConnection()
const assetsQuery = useAssetsQuery()
const probeHistoryQuery = useAllProbeHistoryQuery()
const credentialsQuery = useCredentialsQuery()
const createMutation = useCreateAssetMutation()
const updateMutation = useUpdateAssetMutation()
const deleteMutation = useDeleteAssetMutation()
const createCredentialMutation = useCreateCredentialMutation()
const probeAllMutation = useProbeAssetsMutation()
const probeAssetMutation = useProbeAssetMutation()
const { t } = useI18n()
const isOpenWrt = getPanelRuntimeConfig().deployment === 'openwrt'

const searchInput = ref<HTMLInputElement | null>(null)
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const protocol = ref<'all' | AssetProtocol>(
  route.query.protocol === 'ssh' || route.query.protocol === 'tcp' ? route.query.protocol : 'all',
)
const ownership = ref<'all' | 'local' | 'config'>('all')
const credentialState = ref<'all' | 'configured' | 'missing'>('all')
const healthFilter = ref<HealthFilter>('all')
const selectedTag = ref<string | null>(null)

const editor = ref<HTMLDialogElement | null>(null)
const editorOpen = ref(false)
const editingAsset = ref<Asset | null>(null)
const deleteOpen = ref(false)
const sshConfigOpen = ref(false)
const bootstrapOpen = ref(false)
const feedback = ref('')
const fieldErrors = ref<Record<string, string>>({})
const selectionOpenedHere = ref(false)
const probingAssetId = ref<string | null>(null)
const copiedAssetId = ref<string | null>(null)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const credentialFormMode = ref<CredentialFormMode>('existing')
const inlineCredential = reactive({
  name: '',
  username: 'root',
  authType: 'password' as CredentialAuthType,
  password: '',
  privateKey: '',
  passphrase: '',
})

const form = reactive({
  name: '',
  protocol: 'ssh' as AssetProtocol,
  hostname: '',
  port: 22,
  displayName: '',
  description: '',
  tags: '',
  credentialId: '',
  viaAssetId: '',
  allowTcpForwarding: true,
})

const selectedId = computed(() =>
  typeof route.query.asset === 'string' ? route.query.asset : null,
)
const selectedAsset = computed(
  () => assetsQuery.data.value?.find((asset) => asset.id === selectedId.value) ?? null,
)
const selectedBoundCredential = computed(() => {
  const credentialId = selectedAsset.value?.credentialId
  if (!credentialId) return null
  return credentialsQuery.data.value?.find((cred) => cred.id === credentialId) ?? null
})
const jumpCandidates = computed(() =>
  (assetsQuery.data.value ?? []).filter(
    (asset) =>
      asset.protocol === 'ssh' &&
      asset.credentialId !== null &&
      asset.id !== editingAsset.value?.id,
  ),
)
const hasOwnership = computed(() => runtime.capabilities.value?.ownership === true)

const defaultHopHost = computed(() =>
  inferDefaultHopHost(connection.state.endpoint, globalThis.location?.hostname),
)
const defaultHopPort = computed(() => parseSshListenPort(connection.state.sshListen))

const allTags = computed(() => {
  const tagSet = new Set<string>()
  for (const asset of assetsQuery.data.value ?? []) {
    for (const tag of asset.tags) {
      if (tag.trim()) tagSet.add(tag.trim())
    }
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b))
})

const filteredAssets = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return (assetsQuery.data.value ?? []).filter((asset) => {
    const matchesSearch =
      needle === '' ||
      [
        asset.name,
        asset.displayName ?? '',
        asset.hostname,
        String(asset.port),
        asset.description ?? '',
        asset.viaAssetName ?? '',
        ...asset.tags,
      ]
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
    const status = asset.health?.status ?? 'unknown'
    const matchesHealth = healthFilter.value === 'all' || status === healthFilter.value
    const matchesTag = selectedTag.value === null || asset.tags.includes(selectedTag.value)
    return (
      matchesSearch &&
      matchesProtocol &&
      matchesOwnership &&
      matchesCredential &&
      matchesHealth &&
      matchesTag
    )
  })
})

const counts = computed(() => {
  const list = assetsQuery.data.value ?? []
  return {
    all: list.length,
    ssh: list.filter((asset) => asset.protocol === 'ssh').length,
    tcp: list.filter((asset) => asset.protocol === 'tcp').length,
    healthy: list.filter((asset) => asset.health?.status === 'healthy').length,
    failed: list.filter((asset) => asset.health?.status === 'failed').length,
  }
})

function credentialName(asset: Asset) {
  if (asset.protocol === 'tcp') return t('Not used')
  if (asset.credentialId === null) return t('Missing')
  return (
    credentialsQuery.data.value?.find((credential) => credential.id === asset.credentialId)?.name ??
    t('Configured')
  )
}

function viaLabelFor(asset: Asset): string | null {
  if (asset.viaAssetName) return asset.viaAssetName
  if (!asset.viaAssetId) return null
  return (
    assetsQuery.data.value?.find((candidate) => candidate.id === asset.viaAssetId)?.name ??
    asset.viaAssetId
  )
}

interface ProbeSparkTick {
  key: string
  className: string
}

function probeSparkTicks(assetId: string, count = 24): ProbeSparkTick[] {
  const samples = probeHistoryQuery.data.value?.[assetId] ?? []
  const recent = samples.slice(-count)
  const padCount = Math.max(0, count - recent.length)
  const ticks: ProbeSparkTick[] = []
  for (let idx = 0; idx < padCount; idx += 1) {
    ticks.push({ key: `pad-${idx}`, className: '' })
  }
  for (const sample of recent) {
    let className = ''
    if (sample.status === 'failed') {
      className = 'probe-tick--fail'
    } else if (sample.status === 'healthy') {
      className =
        sample.latencyMs !== null && sample.latencyMs >= 110
          ? 'probe-tick--slow'
          : 'probe-tick--ok'
    }
    ticks.push({ key: `sample-${sample.id}`, className })
  }
  return ticks
}

function ownershipLabel(asset: Asset) {
  return asset.management?.mode === 'config'
    ? t('Configuration file ownership')
    : t('Panel / local ownership')
}

function connectCommandFor(asset: Asset): string {
  return buildAssetConnectCommand(asset, defaultHopHost.value, defaultHopPort.value)
}

function healthPillClass(asset: Asset): string {
  const health = asset.health
  if (!health || health.status === 'unknown') return ''
  if (health.status === 'failed') return 'rtt-pill--failed'
  if (health.latencyMs !== null && health.latencyMs >= 110) return 'rtt-pill--medium'
  return 'rtt-pill--fast'
}

function healthPillLabel(asset: Asset): string {
  const health = asset.health
  if (!health || health.status === 'unknown') return t('Unprobed')
  if (health.status === 'failed') return t('Unreachable')
  return health.latencyMs !== null ? `${health.latencyMs} ms` : t('Healthy')
}

async function copyConnect(asset: Asset) {
  if (!navigator.clipboard) return
  await navigator.clipboard.writeText(connectCommandFor(asset))
  copiedAssetId.value = asset.id
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copiedAssetId.value = null
  }, 1600)
}

async function runProbeAll() {
  feedback.value = ''
  try {
    await probeAllMutation.mutateAsync()
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : t('Asset action was not completed')
  }
}

async function runProbeOne(asset: Asset) {
  feedback.value = ''
  probingAssetId.value = asset.id
  try {
    await probeAssetMutation.mutateAsync(asset.id)
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : t('Asset action was not completed')
  } finally {
    probingAssetId.value = null
  }
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
  healthFilter.value = 'all'
  selectedTag.value = null
}

function resetInlineCredential() {
  credentialFormMode.value = 'existing'
  Object.assign(inlineCredential, {
    name: '',
    username: 'root',
    authType: 'password' as CredentialAuthType,
    password: '',
    privateKey: '',
    passphrase: '',
  })
}

function openCreate() {
  editingAsset.value = null
  Object.assign(form, {
    name: '',
    protocol: 'ssh',
    hostname: '',
    port: 22,
    displayName: '',
    description: '',
    tags: '',
    credentialId: '',
    viaAssetId: '',
    allowTcpForwarding: true,
  })
  resetInlineCredential()
  fieldErrors.value = {}
  feedback.value = ''
  editorOpen.value = true
}

function openEdit(asset: Asset) {
  if (asset.management?.mode === 'config') return
  editingAsset.value = asset
  Object.assign(form, {
    name: asset.name,
    protocol: asset.protocol,
    hostname: asset.hostname,
    port: asset.port,
    displayName: asset.displayName ?? '',
    description: asset.description ?? '',
    tags: asset.tags.join(', '),
    credentialId: asset.credentialId ?? '',
    viaAssetId: asset.viaAssetId ?? '',
    allowTcpForwarding: asset.allowTcpForwarding !== false,
  })
  resetInlineCredential()
  fieldErrors.value = {}
  feedback.value = ''
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
}

function buildInlineCredentialInput(): CredentialWriteInput {
  const fallbackName = form.name.trim() ? `${form.name.trim()}-cred` : ''
  const name = inlineCredential.name.trim() || fallbackName
  const username = inlineCredential.username.trim()
  if (!name) throw new Error(t('Give this credential a recognizable name.'))
  if (!username) throw new Error(t('Enter the target account username.'))
  if (inlineCredential.authType === 'password') {
    if (!inlineCredential.password) throw new Error(t('Enter the password that Hop should store.'))
    return {
      name,
      username,
      authType: 'password',
      password: inlineCredential.password,
    }
  }
  if (!inlineCredential.privateKey.trim()) {
    throw new Error(t('Paste the complete private key.'))
  }
  if (inlineCredential.authType === 'key_passphrase' && !inlineCredential.passphrase) {
    throw new Error(t('Enter the passphrase for this private key.'))
  }
  return {
    name,
    username,
    authType: inlineCredential.authType,
    privateKey: inlineCredential.privateKey,
    passphrase:
      inlineCredential.authType === 'key_passphrase' ? inlineCredential.passphrase : null,
  }
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

  try {
    let resolvedCredentialId: string | null = null
    if (result.data.protocol === 'ssh') {
      if (credentialFormMode.value === 'inline') {
        const createdCred = await createCredentialMutation.mutateAsync(
          buildInlineCredentialInput(),
        )
        resolvedCredentialId = createdCred.id
      } else {
        resolvedCredentialId = result.data.credentialId || null
      }
    }

    const input: AssetWriteInput = {
      name: result.data.name,
      protocol: result.data.protocol,
      hostname: result.data.hostname,
      port: result.data.port,
      displayName: result.data.displayName.trim() || null,
      description: result.data.description.trim() || null,
      tags: result.data.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      credentialId: resolvedCredentialId,
      viaAssetId: form.viaAssetId || null,
      allowTcpForwarding: result.data.protocol === 'ssh' ? form.allowTcpForwarding : true,
    }

    const saved = editingAsset.value
      ? await updateMutation.mutateAsync({ id: editingAsset.value.id, input })
      : await createMutation.mutateAsync(input)
    closeEditor()
    setSelection(saved.id)
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : t('The asset could not be saved.')
  }
}

async function confirmDelete() {
  if (selectedAsset.value === null || selectedAsset.value.management?.mode === 'config') return
  feedback.value = ''
  try {
    await deleteMutation.mutateAsync(selectedAsset.value.id)
    deleteOpen.value = false
    setSelection(null)
  } catch (error) {
    deleteOpen.value = false
    feedback.value = error instanceof Error ? error.message : t('The asset could not be removed.')
  }
}

function handleSlashShortcut(event: KeyboardEvent) {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
  const active = event.target
  if (active instanceof HTMLElement) {
    const tagName = active.tagName.toLowerCase()
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      active.isContentEditable ||
      active.closest('dialog')
    ) {
      return
    }
  }
  event.preventDefault()
  searchInput.value?.focus()
}

onMounted(() => {
  window.addEventListener('keydown', handleSlashShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleSlashShortcut)
  if (copyTimer) clearTimeout(copyTimer)
})

watch(editorOpen, async (open) => {
  await nextTick()
  if (open && !editor.value?.open) editor.value?.showModal()
  if (!open && editor.value?.open) editor.value.close()
})

watch(
  () => form.protocol,
  (value) => {
    if (value === 'tcp') {
      form.credentialId = ''
      credentialFormMode.value = 'existing'
    }
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
    <header class="page-intro">
      <div>
        <h1>{{ t('Assets') }}</h1>
        <p>{{ t('Assets intro description') }}</p>
      </div>
      <div class="page-intro__actions">
        <BaseButton
          variant="secondary"
          :disabled="!runtime.ready.value"
          @click="sshConfigOpen = true"
        >
          <template #leading><SquareTerminal /></template>
          {{ t('SSH Config') }}
        </BaseButton>
        <BaseButton
          variant="secondary"
          :disabled="!runtime.ready.value || counts.all === 0"
          :loading="probeAllMutation.isPending.value"
          :loading-label="t('Probing…')"
          @click="void runProbeAll()"
        >
          <template #leading><Activity /></template>
          {{ t('Probe all') }}
        </BaseButton>
        <BaseButton
          variant="primary"
          :disabled="!runtime.ready.value"
          @click="openCreate"
        >
          <template #leading><Plus /></template>
          {{ t('New asset') }}
        </BaseButton>
      </div>
    </header>

    <InlineNotice v-if="feedback && !editorOpen" tone="danger" :title="t('Asset action was not completed')">
      <p>{{ feedback }}</p>
    </InlineNotice>

    <div class="assets-workspace" :class="{ 'has-selection': Boolean(selectedAsset) }">
      <section class="asset-inventory panel">
        <header class="asset-toolbar">
          <div class="toolbar-primary">
            <label class="search-control">
              <Search :size="16" aria-hidden="true" />
              <span class="sr-only">{{ t('Search assets') }}</span>
              <input
                ref="searchInput"
                v-model="search"
                type="search"
                :placeholder="t('Press / to search assets…')"
              />
              <button
                v-if="search"
                class="clear-search"
                type="button"
                :aria-label="t('Clear search')"
                @click="search = ''"
              >
                <X :size="14" aria-hidden="true" />
              </button>
            </label>

            <div class="segmented-control" role="group" :aria-label="t('Protocol')">
              <button
                type="button"
                :class="{ 'is-active': protocol === 'all' }"
                :aria-pressed="protocol === 'all'"
                @click="protocol = 'all'"
              >
                {{ t('All assets') }} <span class="count">{{ counts.all }}</span>
              </button>
              <button
                type="button"
                :class="{ 'is-active': protocol === 'ssh' }"
                :aria-pressed="protocol === 'ssh'"
                @click="protocol = 'ssh'"
              >
                SSH <span class="count">{{ counts.ssh }}</span>
              </button>
              <button
                type="button"
                :class="{ 'is-active': protocol === 'tcp' }"
                :aria-pressed="protocol === 'tcp'"
                @click="protocol = 'tcp'"
              >
                TCP <span class="count">{{ counts.tcp }}</span>
              </button>
            </div>

            <label class="compact-select">
              <span class="sr-only">{{ t('Health') }}</span>
              <select v-model="healthFilter">
                <option value="all">{{ t('All health') }}</option>
                <option value="healthy">{{ t('Healthy') }}</option>
                <option value="failed">{{ t('Unreachable') }}</option>
                <option value="unknown">{{ t('Unprobed') }}</option>
              </select>
            </label>

            <label class="compact-select">
              <span class="sr-only">{{ t('Credential status') }}</span>
              <select v-model="credentialState">
                <option value="all">{{ t('Any credential') }}</option>
                <option value="configured">{{ t('Configured') }}</option>
                <option value="missing">{{ t('Missing') }}</option>
              </select>
            </label>

            <label v-if="hasOwnership" class="compact-select">
              <span class="sr-only">{{ t('Ownership') }}</span>
              <select v-model="ownership">
                <option value="all">{{ t('Any owner') }}</option>
                <option value="local">{{ t('Panel / local ownership') }}</option>
                <option value="config">{{ t('Configuration file ownership') }}</option>
              </select>
            </label>
          </div>

          <div v-if="allTags.length > 0" class="tag-filter-bar" :aria-label="t('Tags')">
            <button
              v-for="tag in allTags"
              :key="tag"
              type="button"
              class="tag-chip"
              :class="{ 'is-active': selectedTag === tag }"
              :aria-pressed="selectedTag === tag"
              @click="selectedTag = selectedTag === tag ? null : tag"
            >
              #{{ tag }}
            </button>
          </div>
        </header>

        <div
          class="asset-table"
          :class="{ 'no-ownership': !hasOwnership }"
          role="table"
          :aria-label="t('Catalog assets')"
        >
          <div class="asset-head" role="row">
            <span role="columnheader">{{ t('Name') }}</span>
            <span class="col-protocol" role="columnheader">{{ t('Protocol') }}</span>
            <span role="columnheader">{{ t('Address') }}</span>
            <span role="columnheader">{{ t('Latency / health') }}</span>
            <span class="col-credential" role="columnheader">{{ t('Credential') }}</span>
            <span v-if="hasOwnership" class="col-ownership ownership-head" role="columnheader">{{ t('Ownership') }}</span>
            <span class="head-actions" role="columnheader">{{ t('Actions') }}</span>
          </div>

          <div
            v-for="asset in filteredAssets"
            :key="asset.id"
            class="asset-row"
            :class="{ selected: asset.id === selectedId }"
            role="row"
          >
            <button
              type="button"
              class="asset-row__main"
              :aria-pressed="asset.id === selectedId"
              @click="setSelection(asset.id)"
            >
              <span class="asset-name" role="cell">
                <span class="protocol-icon" :class="`is-${asset.protocol}`" aria-hidden="true">
                  <Server v-if="asset.protocol === 'ssh'" :size="15" />
                  <Boxes v-else :size="15" />
                </span>
                <span class="asset-name__copy">
                  <span class="asset-name__title">
                    <strong>{{ asset.name }}</strong>
                    <em v-if="asset.displayName">{{ asset.displayName }}</em>
                    <span v-if="viaLabelFor(asset)" class="via-pill">via {{ viaLabelFor(asset) }}</span>
                  </span>
                  <small>
                    {{ asset.description || asset.tags.map((tag) => `#${tag}`).join(' ') || t('No description') }}
                  </small>
                </span>
              </span>

              <span class="col-protocol" role="cell">
                <StatusBadge :label="asset.protocol.toUpperCase()" :tone="asset.protocol === 'ssh' ? 'info' : 'neutral'" />
              </span>

              <span class="mono address tabular" role="cell">{{ asset.hostname }}:{{ asset.port }}</span>

              <span class="col-health health-cell" role="cell">
                <span class="rtt-pill" :class="healthPillClass(asset)">
                  <span class="rtt-pill__dot" aria-hidden="true" />
                  {{ healthPillLabel(asset) }}
                </span>
                <span class="probe-spark" aria-hidden="true">
                  <span
                    v-for="tick in probeSparkTicks(asset.id, 14)"
                    :key="tick.key"
                    class="probe-tick"
                    :class="tick.className"
                  />
                </span>
              </span>

              <span
                class="credential-cell col-credential"
                :class="{ missing: asset.protocol === 'ssh' && !asset.credentialId }"
                role="cell"
              >
                <CircleDot :size="12" aria-hidden="true" />
                <span>{{ credentialName(asset) }}</span>
              </span>

              <span v-if="hasOwnership" class="ownership-cell col-ownership" role="cell">
                <StatusBadge
                  :label="ownershipLabel(asset)"
                  :tone="asset.management?.mode === 'config' ? 'info' : 'neutral'"
                />
              </span>
            </button>

            <div class="asset-row__quick" role="cell">
              <button
                class="row-icon-btn"
                type="button"
                :aria-label="`${t('Copy connect command')} · ${asset.name}`"
                :title="connectCommandFor(asset)"
                @click="void copyConnect(asset)"
              >
                <Check v-if="copiedAssetId === asset.id" :size="15" class="copied-icon" aria-hidden="true" />
                <Copy v-else :size="15" aria-hidden="true" />
              </button>
              <button
                class="row-icon-btn"
                type="button"
                :disabled="probingAssetId === asset.id || probeAllMutation.isPending.value"
                :aria-label="`${t('Probe asset')} · ${asset.name}`"
                :title="t('Probe asset')"
                @click="void runProbeOne(asset)"
              >
                <Activity
                  :size="15"
                  :class="{ 'is-pulsing': probingAssetId === asset.id }"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <EmptyState
            v-if="!assetsQuery.isPending.value && filteredAssets.length === 0"
            :compact="true"
            :title="t('No matching assets')"
            :description="t('Clear filters or add a local SSH or TCP target.')"
          >
            <template #actions>
              <BaseButton variant="secondary" @click="clearFilters">
                <template #leading><Filter /></template>
                {{ t('Clear filters') }}
              </BaseButton>
            </template>
          </EmptyState>

          <div
            v-if="assetsQuery.isPending.value"
            class="loading-rows"
            :aria-label="t('Loading assets')"
            aria-busy="true"
          >
            <span /><span /><span /><span />
          </div>
        </div>

        <footer class="inventory-footer tabular">
          <span>{{ t('{visible} of {total} assets', { visible: filteredAssets.length, total: counts.all }) }}</span>
          <span class="footer-health">
            {{ counts.healthy }} {{ t('Healthy').toLowerCase() }}
            <template v-if="counts.failed > 0"> · {{ counts.failed }} {{ t('Unreachable').toLowerCase() }}</template>
          </span>
        </footer>
      </section>

      <aside
        v-if="selectedAsset"
        class="asset-inspector panel"
        :aria-label="t('Selected asset')"
      >
        <header class="inspector-heading">
          <span class="inspector-icon" :class="`is-${selectedAsset.protocol}`" aria-hidden="true">
            <Server v-if="selectedAsset.protocol === 'ssh'" :size="18" />
            <Boxes v-else :size="18" />
          </span>
          <div class="inspector-title">
            <h2>{{ selectedAsset.name }}</h2>
            <p>
              {{ selectedAsset.displayName ? `${selectedAsset.displayName} · ` : '' }}{{ t('{protocol} asset', { protocol: selectedAsset.protocol.toUpperCase() }) }}
            </p>
          </div>
          <button
            class="close-inspector"
            type="button"
            :aria-label="t('Close asset details')"
            @click="setSelection(null)"
          >
            <X :size="17" />
          </button>
        </header>

        <section class="inspector-block">
          <div class="inspector-block__head">
            <span>{{ t('Quick connect') }}</span>
            <button
              class="text-link-btn"
              type="button"
              @click="sshConfigOpen = true"
            >
              ~/.ssh/config
            </button>
          </div>
          <div class="code-snippet">
            <code :title="connectCommandFor(selectedAsset)">{{ connectCommandFor(selectedAsset) }}</code>
            <BaseButton
              size="sm"
              variant="secondary"
              @click="void copyConnect(selectedAsset)"
            >
              <template #leading>
                <Check v-if="copiedAssetId === selectedAsset.id" />
                <Copy v-else />
              </template>
              {{ t(copiedAssetId === selectedAsset.id ? 'Copied' : 'Copy connect command') }}
            </BaseButton>
          </div>
        </section>

        <section class="inspector-block health-card">
          <div class="health-card__row">
            <div>
              <span class="inspector-block__label">{{ t('Latency / health') }}</span>
              <small class="health-card__sub">
                {{ t(selectedAsset.protocol === 'ssh' ? 'TCP + SSH banner check from Hop' : 'TCP port check from Hop') }}
              </small>
            </div>
            <div class="health-card__pills">
              <StatusBadge
                v-if="selectedAsset.health?.alertFiring"
                :label="t('Alert firing')"
                tone="danger"
              />
              <span class="rtt-pill" :class="healthPillClass(selectedAsset)">
                <span class="rtt-pill__dot" aria-hidden="true" />
                {{ healthPillLabel(selectedAsset) }}
              </span>
            </div>
          </div>

          <div class="probe-history-block">
            <span class="probe-history-label">{{ t('Recent 24 probes') }}</span>
            <div class="probe-spark probe-spark--wide" aria-hidden="true">
              <span
                v-for="tick in probeSparkTicks(selectedAsset.id, 24)"
                :key="tick.key"
                class="probe-tick"
                :class="tick.className"
              />
            </div>
          </div>

          <p
            v-if="selectedAsset.health?.status === 'failed' && selectedAsset.health.errorMessage"
            class="health-error"
          >
            {{ selectedAsset.health.errorMessage }}
          </p>

          <div class="health-card__footer">
            <span class="health-checked tabular">
              {{ t('Last checked') }}: {{ selectedAsset.health?.checkedAt ? formatRelativeTime(selectedAsset.health.checkedAt) : t('Unchecked') }}
            </span>
            <BaseButton
              size="sm"
              variant="secondary"
              :loading="probingAssetId === selectedAsset.id"
              :loading-label="t('Probing…')"
              @click="void runProbeOne(selectedAsset)"
            >
              <template #leading><Activity /></template>
              {{ t('Probe now') }}
            </BaseButton>
          </div>
        </section>

        <dl class="inspector-fields">
          <div>
            <dt>{{ t('Protocol') }}</dt>
            <dd>{{ selectedAsset.protocol.toUpperCase() }}</dd>
          </div>
          <div>
            <dt>{{ t('Address') }}</dt>
            <dd class="mono tabular">{{ selectedAsset.hostname }}:{{ selectedAsset.port }}</dd>
          </div>
          <div>
            <dt>{{ t('Jump via') }}</dt>
            <dd>
              <span v-if="viaLabelFor(selectedAsset)" class="via-pill">
                via {{ viaLabelFor(selectedAsset) }}
              </span>
              <span v-else>{{ t('Direct from Hop') }}</span>
            </dd>
          </div>
          <div v-if="selectedAsset.protocol === 'ssh'">
            <dt>{{ t('TCP port forwarding') }}</dt>
            <dd>{{ t(selectedAsset.allowTcpForwarding !== false ? 'Enabled (-L / -D / IDE)' : 'Disabled') }}</dd>
          </div>
          <div v-if="selectedAsset.displayName">
            <dt>{{ t('Display name') }}</dt>
            <dd>{{ selectedAsset.displayName }}</dd>
          </div>
          <div>
            <dt>{{ t('Credential') }}</dt>
            <dd>{{ credentialName(selectedAsset) }}</dd>
          </div>
          <div v-if="hasOwnership" class="ownership-field">
            <dt>{{ t('Ownership') }}</dt>
            <dd>{{ ownershipLabel(selectedAsset) }}</dd>
          </div>
          <div>
            <dt>{{ t('Updated') }}</dt>
            <dd class="tabular">{{ formatTimestamp(selectedAsset.updatedAt) }}</dd>
          </div>
          <div v-if="selectedAsset.tags.length">
            <dt>{{ t('Tags') }}</dt>
            <dd class="tag-list">
              <span v-for="tag in selectedAsset.tags" :key="tag" class="tag-chip">#{{ tag }}</span>
            </dd>
          </div>
        </dl>

        <InlineNotice
          v-if="selectedAsset.management?.mode === 'config'"
          tone="info"
          :title="t(isOpenWrt ? 'OpenWrt managed config title' : 'Managed by hop.yaml')"
        >
          <p>{{ t('Config asset read-only explanation') }}</p>
        </InlineNotice>

        <section v-if="selectedAsset.management?.mode !== 'config'" class="inspector-actions">
          <h3>{{ t('Actions') }}</h3>
          <BaseButton
            v-if="selectedAsset.protocol === 'ssh'"
            variant="primary"
            @click="bootstrapOpen = true"
          >
            <template #leading><KeyRound /></template>
            {{ t('Bootstrap SSH key') }}
          </BaseButton>
          <div class="inspector-actions__row">
            <BaseButton variant="secondary" @click="openEdit(selectedAsset)">
              <template #leading><Pencil /></template>
              {{ t('Edit asset') }}
            </BaseButton>
            <BaseButton variant="danger" @click="deleteOpen = true">
              <template #leading><Trash2 /></template>
              {{ t('Remove asset') }}
            </BaseButton>
          </div>
        </section>
      </aside>
    </div>

    <dialog
      ref="editor"
      class="asset-editor"
      @close="editorOpen = false"
      @cancel.prevent="closeEditor"
    >
      <form class="editor-form" @submit.prevent="submitAsset">
        <header>
          <div>
            <h2>{{ t(editingAsset ? 'Edit asset' : 'New asset') }}</h2>
            <p>{{ t(editingAsset ? 'Update the local Catalog record.' : 'Add an SSH or TCP target to the local Catalog.') }}</p>
          </div>
          <button type="button" :aria-label="t('Close editor')" @click="closeEditor">
            <X :size="18" />
          </button>
        </header>

        <InlineNotice v-if="feedback" tone="danger">
          <p>{{ feedback }}</p>
        </InlineNotice>

        <div class="form-grid">
          <label>
            <span>{{ t('Name') }}</span>
            <input v-model="form.name" autocomplete="off" :aria-invalid="Boolean(fieldErrors.name)" />
            <small v-if="fieldErrors.name">{{ fieldErrors.name }}</small>
          </label>
          <label>
            <span>{{ t('Protocol') }}</span>
            <select v-model="form.protocol">
              <option value="ssh">SSH</option>
              <option value="tcp">TCP</option>
            </select>
          </label>

          <label class="wide-field">
            <span>{{ t('Display name') }}</span>
            <input v-model="form.displayName" autocomplete="off" :placeholder="t('Optional friendly label, e.g. HKG Edge Node.')" />
          </label>

          <label class="host-field">
            <span>{{ t('Hostname or IP') }}</span>
            <input v-model="form.hostname" spellcheck="false" :aria-invalid="Boolean(fieldErrors.hostname)" />
            <small v-if="fieldErrors.hostname">{{ fieldErrors.hostname }}</small>
          </label>
          <label>
            <span>{{ t('Port') }}</span>
            <input v-model.number="form.port" type="number" min="1" max="65535" :aria-invalid="Boolean(fieldErrors.port)" />
            <small v-if="fieldErrors.port">{{ fieldErrors.port }}</small>
          </label>

          <label class="wide-field">
            <span>{{ t('Jump via') }}</span>
            <select v-model="form.viaAssetId">
              <option value="">{{ t('Direct from Hop') }}</option>
              <option
                v-for="candidate in jumpCandidates"
                :key="candidate.id"
                :value="candidate.id"
              >
                {{ candidate.name }} ({{ candidate.hostname }}:{{ candidate.port }})
              </option>
            </select>
            <small>{{ t('Select a managed SSH jump asset (up to 4 hops).') }}</small>
          </label>

          <div v-if="form.protocol === 'ssh'" class="wide-field credential-block">
            <div class="credential-block__head">
              <span>{{ t('Credential') }}</span>
              <div class="segmented-control">
                <button
                  type="button"
                  :class="{ 'is-active': credentialFormMode === 'existing' }"
                  @click="credentialFormMode = 'existing'"
                >
                  {{ t('Select existing') }}
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': credentialFormMode === 'inline' }"
                  @click="credentialFormMode = 'inline'"
                >
                  {{ t('New credential inline') }}
                </button>
              </div>
            </div>

            <label v-if="credentialFormMode === 'existing'" class="credential-select-label">
              <span class="sr-only">{{ t('Credential') }}</span>
              <select v-model="form.credentialId">
                <option value="">{{ t('No credential') }}</option>
                <option
                  v-for="credential in credentialsQuery.data.value ?? []"
                  :key="credential.id"
                  :value="credential.id"
                >
                  {{ credential.name }} · {{ credential.username }}
                </option>
              </select>
            </label>

            <div v-else class="inline-cred-fields">
              <div class="inline-cred-row">
                <label>
                  <span>{{ t('Credential name') }}</span>
                  <input v-model="inlineCredential.name" autocomplete="off" :placeholder="form.name ? `${form.name}-cred` : 'hk-root'" />
                </label>
                <label>
                  <span>{{ t('Target username') }}</span>
                  <input v-model="inlineCredential.username" autocomplete="off" />
                </label>
              </div>
              <label>
                <span>{{ t('Authentication') }}</span>
                <select v-model="inlineCredential.authType">
                  <option value="password">{{ t('Password') }}</option>
                  <option value="key">{{ t('Private key') }}</option>
                  <option value="key_passphrase">{{ t('Private key + passphrase') }}</option>
                </select>
              </label>
              <label v-if="inlineCredential.authType === 'password'">
                <span>{{ t('Password') }}</span>
                <input v-model="inlineCredential.password" type="password" autocomplete="new-password" />
              </label>
              <template v-else>
                <label>
                  <span>{{ t('Private key') }}</span>
                  <textarea v-model="inlineCredential.privateKey" rows="3" class="mono" spellcheck="false" />
                </label>
                <label v-if="inlineCredential.authType === 'key_passphrase'">
                  <span>{{ t('Passphrase') }}</span>
                  <input v-model="inlineCredential.passphrase" type="password" autocomplete="new-password" />
                </label>
              </template>
              <small>{{ t('Secret form boundary') }}</small>
            </div>
          </div>

          <label v-if="form.protocol === 'ssh'" class="wide-field forwarding-toggle">
            <input v-model="form.allowTcpForwarding" type="checkbox" />
            <span>{{ t('Allow -L / -D / Cursor Remote-SSH forwarding') }}</span>
          </label>

          <label class="wide-field">
            <span>{{ t('Tags') }}</span>
            <input v-model="form.tags" placeholder="production, edge, hk" />
            <small>{{ t('Comma-separated labels.') }}</small>
          </label>
          <label class="wide-field">
            <span>{{ t('Description') }}</span>
            <textarea v-model="form.description" rows="2" />
          </label>
        </div>

        <footer>
          <BaseButton variant="secondary" @click="closeEditor">{{ t('Cancel') }}</BaseButton>
          <BaseButton
            variant="primary"
            type="submit"
            :loading="createMutation.isPending.value || updateMutation.isPending.value || createCredentialMutation.isPending.value"
          >
            <template #leading><Plus /></template>
            {{ t(editingAsset ? 'Save changes' : 'Create asset action') }}
          </BaseButton>
        </footer>
      </form>
    </dialog>

    <SshConfigDialog
      v-model:open="sshConfigOpen"
      :assets="assetsQuery.data.value ?? []"
      :credentials="credentialsQuery.data.value ?? []"
    />

    <BootstrapKeyDialog
      v-model:open="bootstrapOpen"
      :asset="selectedAsset"
      :bound-credential="selectedBoundCredential"
    />

    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="t('Remove this asset?')"
      :description="selectedAsset ? t('{name} will be deleted from the local Catalog. This cannot be undone.', { name: selectedAsset.name }) : ''"
      :confirm-label="t('Remove asset')"
      :busy="deleteMutation.isPending.value"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.assets-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 14px;
}

.assets-workspace.has-selection {
  grid-template-columns: minmax(0, 1fr) 368px;
}

.asset-inventory {
  display: grid;
  min-width: 0;
  overflow: hidden;
}

.asset-toolbar {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}

.toolbar-primary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.search-control {
  display: flex;
  min-width: 210px;
  flex: 1 1 240px;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  color: var(--text-muted);
}

.search-control:focus-within {
  border-color: var(--focus);
}

.search-control input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-strong);
  outline: 0;
}

.clear-search {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.compact-select select {
  height: 38px;
  padding: 0 28px 0 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  font-size: 12.5px;
}

.tag-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.asset-table {
  min-width: 0;
  overflow-x: auto;
}

.asset-head {
  display: grid;
  min-width: 820px;
  grid-template-columns: minmax(200px, 1.5fr) 78px minmax(145px, 1fr) 118px minmax(120px, 0.9fr) minmax(118px, 0.85fr) 74px;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.asset-table.no-ownership .asset-head {
  min-width: 700px;
  grid-template-columns: minmax(200px, 1.55fr) 78px minmax(145px, 1fr) 118px minmax(120px, 0.9fr) 74px;
}

.head-actions {
  text-align: right;
}

.asset-row {
  display: grid;
  min-width: 820px;
  grid-template-columns: minmax(0, 1fr) 74px;
  align-items: center;
  gap: 10px;
  padding-right: 14px;
  border-bottom: 1px solid var(--line);
  transition: background-color 120ms ease;
}

.asset-table.no-ownership .asset-row {
  min-width: 700px;
}

.asset-row:hover {
  background: var(--surface-hover);
}

.asset-row.selected {
  background: var(--surface-selected);
}

.asset-row__main {
  display: grid;
  width: 100%;
  min-height: 56px;
  grid-template-columns: minmax(200px, 1.5fr) 78px minmax(145px, 1fr) 118px minmax(120px, 0.9fr) minmax(118px, 0.85fr);
  align-items: center;
  gap: 10px;
  padding: 6px 0 6px 14px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.asset-table.no-ownership .asset-row__main {
  grid-template-columns: minmax(200px, 1.55fr) 78px minmax(145px, 1fr) 118px minmax(120px, 0.9fr);
}

.asset-row__main > span {
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

.asset-row__main > span.asset-name {
  white-space: normal;
}

.asset-name__copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.asset-name__title {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 7px;
}

.asset-name__title strong {
  flex: 0 0 auto;
  color: var(--text-strong);
  font-weight: 620;
}

.asset-name__title em {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-name small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11.5px;
  text-overflow: ellipsis;
}

.protocol-icon,
.inspector-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-muted);
}

.protocol-icon.is-ssh,
.inspector-icon.is-ssh {
  border-color: color-mix(in srgb, var(--info) 28%, var(--line));
  color: var(--info);
}

.address {
  color: var(--text-strong);
  font-size: 12.5px;
}

.health-cell {
  display: grid;
  justify-items: start;
  gap: 4px;
}

.credential-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-strong);
  font-size: 12.5px;
}

.credential-cell.missing {
  color: var(--warning);
}

.asset-row__quick {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.row-icon-btn {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}

.row-icon-btn:hover:not(:disabled) {
  border-color: var(--line-strong);
  background: var(--surface-raised);
  color: var(--text-strong);
}

.row-icon-btn:disabled {
  cursor: wait;
  opacity: 0.55;
}

.copied-icon {
  color: var(--accent-strong);
}

.is-pulsing {
  color: var(--accent-strong);
  animation: pulse-probe 800ms ease-in-out infinite alternate;
}

@keyframes pulse-probe {
  to {
    opacity: 0.4;
  }
}

.loading-rows {
  display: grid;
}

.loading-rows span {
  height: 56px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-raised) 50%, transparent);
}

.inventory-footer {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 14px;
  border-top: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 12px;
}

.asset-inspector {
  position: sticky;
  top: 76px;
  display: grid;
  min-width: 0;
  gap: 14px;
  padding: 16px;
}

.inspector-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--line);
}

.inspector-title {
  min-width: 0;
}

.inspector-title h2 {
  margin: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspector-title p {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-inspector,
.editor-form header > button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.close-inspector:hover,
.editor-form header > button:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.inspector-block {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.asset-inspector .code-snippet {
  display: grid;
  align-items: stretch;
  gap: 8px;
}

.asset-inspector .code-snippet code {
  overflow-wrap: anywhere;
  text-overflow: clip;
  white-space: normal;
  line-height: 1.45;
}

.inspector-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
  font-size: 11.5px;
  font-weight: 620;
}

.inspector-block__label {
  display: block;
  color: var(--text-strong);
  font-size: 12.5px;
  font-weight: 620;
}

.text-link-btn {
  padding: 0;
  background: transparent;
  color: var(--info);
  font-family: var(--font-mono);
  font-size: 11.5px;
  cursor: pointer;
}

.text-link-btn:hover {
  text-decoration: underline;
}

.health-card {
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-input);
}

.health-card__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.health-card__pills {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.health-card__sub {
  color: var(--text-muted);
  font-size: 11.5px;
}

.probe-history-block {
  display: grid;
  gap: 5px;
  padding-top: 2px;
}

.probe-history-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.health-error {
  margin: 2px 0 0;
  color: var(--danger);
  font-size: 12px;
}

.health-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--line-subtle);
}

.health-checked {
  color: var(--text-muted);
  font-size: 11.5px;
}

.inspector-fields {
  display: grid;
  margin: 0;
  border-top: 1px solid var(--line);
  padding-top: 6px;
}

.inspector-fields > div {
  display: grid;
  grid-template-columns: 102px minmax(0, 1fr);
  gap: 10px;
  min-height: 38px;
  align-items: center;
}

.inspector-fields dt {
  color: var(--text-muted);
  font-size: 12.5px;
}

.inspector-fields dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--text-strong);
  font-size: 12.5px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.inspector-actions {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.inspector-actions h3 {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.inspector-actions__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.inspector-actions :deep(.base-button--danger) {
  border: 1px solid color-mix(in srgb, var(--danger) 48%, var(--line));
  background: transparent;
  color: var(--danger);
}

.inspector-actions :deep(.base-button--danger:not(:disabled):hover) {
  background: var(--danger-soft);
}

.asset-editor {
  width: min(620px, calc(100vw - 24px));
  max-height: calc(100dvh - 28px);
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 13px;
  background: var(--surface-panel);
  color: var(--text);
  box-shadow: var(--panel-highlight), var(--shadow-layer);
}

.asset-editor::backdrop {
  background: rgba(5, 9, 14, 0.72);
  backdrop-filter: blur(4px);
}

.editor-form {
  display: grid;
  gap: 16px;
  padding: 20px 22px;
}

.editor-form header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.editor-form h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
}

.editor-form header p {
  margin: 3px 0 0;
  color: var(--text-muted);
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  gap: 12px;
}

.form-grid label {
  display: grid;
  align-content: start;
  gap: 5px;
}

.form-grid label > span,
.credential-block__head > span {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 620;
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  width: 100%;
  min-height: 40px;
  padding: 8px 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  outline: 0;
}

.form-grid input:focus,
.form-grid select:focus,
.form-grid textarea:focus {
  border-color: var(--focus);
}

.form-grid textarea {
  resize: vertical;
}

.form-grid small {
  color: var(--text-muted);
  font-size: 12px;
}

.form-grid [aria-invalid='true'] + small {
  color: var(--danger);
}

.wide-field {
  grid-column: 1 / -1;
}

.form-grid label.forwarding-toggle {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-input);
  cursor: pointer;
}

.form-grid label.forwarding-toggle input[type='checkbox'] {
  width: 16px;
  min-height: 16px;
  height: 16px;
  padding: 0;
  accent-color: var(--accent);
}

.credential-block {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: color-mix(in srgb, var(--surface-raised) 50%, var(--surface-panel));
}

.credential-block__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.inline-cred-fields {
  display: grid;
  gap: 10px;
}

.inline-cred-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.editor-form footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (min-width: 1181px) and (max-width: 1680px) {
  .assets-workspace.has-selection .col-protocol,
  .assets-workspace.has-selection .col-ownership {
    display: none;
  }

  .assets-workspace.has-selection .asset-head,
  .assets-workspace.has-selection .asset-table.no-ownership .asset-head {
    min-width: 540px;
    grid-template-columns: minmax(180px, 1.55fr) minmax(136px, 1fr) 108px minmax(105px, 0.85fr) 70px;
  }

  .assets-workspace.has-selection .asset-row,
  .assets-workspace.has-selection .asset-table.no-ownership .asset-row {
    min-width: 540px;
    grid-template-columns: minmax(0, 1fr) 70px;
  }

  .assets-workspace.has-selection .asset-row__main,
  .assets-workspace.has-selection .asset-table.no-ownership .asset-row__main {
    grid-template-columns: minmax(180px, 1.55fr) minmax(136px, 1fr) 108px minmax(105px, 0.85fr);
  }
}

@media (max-width: 1180px) {
  .assets-workspace,
  .assets-workspace.has-selection {
    grid-template-columns: minmax(0, 1fr);
  }

  .asset-inspector {
    position: fixed;
    inset: 58px 0 0 auto;
    z-index: 25;
    width: min(390px, calc(100vw - 72px));
    overflow: auto;
    border-radius: 0;
    border-top: 0;
    border-right: 0;
    border-bottom: 0;
    box-shadow: var(--shadow-layer);
  }
}

@media (max-width: 899px) {
  .assets-workspace.has-selection .asset-inventory {
    visibility: hidden;
  }

  .asset-head {
    display: none;
  }

  .asset-table,
  .asset-table.no-ownership {
    overflow: visible;
  }

  .asset-row,
  .asset-table.no-ownership .asset-row {
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    padding: 6px 10px 6px 0;
  }

  .asset-row__quick {
    padding-top: 8px;
  }

  .asset-row__main,
  .asset-table.no-ownership .asset-row__main {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    gap: 6px 8px;
    padding: 8px 4px 8px 12px;
  }

  .asset-row__main .col-protocol,
  .asset-row__main .col-credential,
  .asset-row__main .col-ownership {
    display: none;
  }

  .asset-row__main .asset-name {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .asset-row__main .col-health {
    grid-column: 1;
    grid-row: 2;
    padding-left: 40px;
  }

  .asset-row__main .address {
    grid-column: 2;
    grid-row: 2;
    color: var(--text-muted);
    font-size: 11.5px;
  }

  .asset-inspector {
    inset: 54px 0 calc(62px + env(safe-area-inset-bottom));
    width: 100%;
    border: 0;
    background: var(--surface-canvas);
    box-shadow: none;
  }

  .form-grid {
    grid-template-columns: 1fr 110px;
  }
}

@media (max-width: 560px) {
  .form-grid,
  .inline-cred-row,
  .inspector-actions__row {
    grid-template-columns: 1fr;
  }

  .editor-form footer {
    display: grid;
    grid-template-columns: 1fr;
  }

  .editor-form footer :deep(.base-button) {
    width: 100%;
  }
}
</style>
