<script setup lang="ts">
import {
  CircleDotDashed,
  Fingerprint,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShieldOff,
  Trash2,
  X,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { BaseButton, ConfirmDialog, EmptyState, InlineNotice, StatusBadge } from '@/components/ui'
import type { KnownHost } from '@/domain'
import { useI18n } from '@/i18n'
import {
  useAssetsQuery,
  useHopApiRuntime,
  useKnownHostsQuery,
  useResetKnownHostMutation,
} from '@/queries'
import { formatTimestamp, shortFingerprint } from '@/utils/format'

type Notice = { tone: 'success' | 'danger'; title: string; message: string }

const knownHostsQuery = useKnownHostsQuery()
const assetsQuery = useAssetsQuery()
const resetMutation = useResetKnownHostMutation()
const runtime = useHopApiRuntime()
const { t } = useI18n()

const search = ref('')
const selectedKey = ref<string | null>(null)
const resetOpen = ref(false)
const notice = ref<Notice | null>(null)

const knownHosts = computed(() => knownHostsQuery.data.value ?? [])
const knownHostsLoading = computed(
  () => runtime.ready.value && knownHostsQuery.isPending.value,
)
const assetsReady = computed(() => assetsQuery.status.value === 'success')
const filteredHosts = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return knownHosts.value
  return knownHosts.value.filter((host) =>
    [host.hostname, host.port, host.keyType, host.fingerprint]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query),
  )
})
const selectedHost = computed(
  () => knownHosts.value.find((host) => hostKey(host) === selectedKey.value) ?? null,
)
const selectedAssets = computed(() => {
  const host = selectedHost.value
  const assets = assetsQuery.data.value
  if (host === null || !assetsReady.value || assets === undefined) return null
  return assets.filter(
    (asset) =>
      asset.protocol === 'ssh' && asset.hostname === host.hostname && asset.port === host.port,
  )
})
const matchedHostCount = computed(() => {
  const assets = assetsQuery.data.value
  if (!assetsReady.value || assets === undefined) return null
  return knownHosts.value.filter((host) =>
    assets.some(
        (asset) =>
          asset.protocol === 'ssh' && asset.hostname === host.hostname && asset.port === host.port,
      ),
  ).length
})
const queryError = computed(() => errorMessage(knownHostsQuery.error.value))

watch(
  knownHosts,
  (hosts) => {
    if (hosts.length === 0) {
      selectedKey.value = null
      return
    }
    if (!hosts.some((host) => hostKey(host) === selectedKey.value)) {
      selectedKey.value = hostKey(hosts[0]!)
    }
  },
  { immediate: true },
)

function hostKey(host: KnownHost): string {
  return `${host.hostname}\u0000${host.port}\u0000${host.keyType}`
}

function hostAddress(host: KnownHost): string {
  return `${host.hostname}:${host.port}`
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return error ? String(error) : ''
}

function selectHost(host: KnownHost) {
  selectedKey.value = hostKey(host)
  notice.value = null
}

async function resetTrust() {
  const host = selectedHost.value
  if (host === null) return

  notice.value = null
  try {
    await resetMutation.mutateAsync({
      hostname: host.hostname,
      port: host.port,
      keyType: host.keyType,
    })
    resetOpen.value = false
    notice.value = {
      tone: 'success',
      title: t('Host trust reset'),
      message: t(
        '{target} was removed from Known Hosts. The next managed connection will establish a new fingerprint through TOFU.',
        { target: hostAddress(host) },
      ),
    }
  } catch (error) {
    resetOpen.value = false
    notice.value = {
      tone: 'danger',
      title: t('Host trust could not be reset'),
      message: errorMessage(error) || t('Check the instance connection and try again.'),
    }
  }
}
</script>

<template>
  <section class="known-hosts-page page-stack" aria-labelledby="known-hosts-title">
    <header class="page-intro known-hosts-intro">
      <div>
        <h1 id="known-hosts-title">{{ t('Host trust') }}</h1>
        <p>{{ t('Target SSH host keys accepted by Trust On First Use and checked on every managed connection.') }}</p>
      </div>
      <button
        class="icon-button"
        type="button"
        :disabled="!runtime.ready.value || knownHostsQuery.isFetching.value"
        :aria-label="t('Refresh host trust')"
        :title="t('Refresh host trust')"
        @click="knownHostsQuery.refetch()"
      >
        <RefreshCw
          :size="18"
          :class="{ 'is-spinning': knownHostsQuery.isFetching.value }"
          aria-hidden="true"
        />
      </button>
    </header>

    <InlineNotice
      v-if="runtime.mode.value === 'reauth'"
      tone="warning"
      :title="t('Reconnect to manage host trust')"
    >
      {{ t('Reauthentication explanation') }}
    </InlineNotice>

    <InlineNotice
      v-if="knownHostsQuery.isError.value && knownHosts.length > 0"
      tone="warning"
      :title="t('Showing the last Known Hosts response')"
    >
      {{ queryError }}
      <template #actions>
        <BaseButton variant="secondary" @click="knownHostsQuery.refetch()">{{ t('Retry') }}</BaseButton>
      </template>
    </InlineNotice>

    <InlineNotice
      v-if="notice"
      :tone="notice.tone"
      :title="notice.title"
    >
      {{ notice.message }}
    </InlineNotice>

    <section class="trust-ledger panel" :aria-label="t('Known Hosts summary')">
      <div class="trust-ledger__lead">
        <span class="trust-ledger__mark" aria-hidden="true"><ShieldCheck :size="21" /></span>
        <div>
          <strong>{{ !runtime.ready.value ? t('Reconnect required') : knownHostsLoading ? t('Reading Known Hosts…') : t('{count} trusted host keys', { count: knownHosts.length }) }}</strong>
          <small>{{ t('A changed key is rejected until you verify the rebuild or rotation and reset its trust record.') }}</small>
        </div>
      </div>
      <dl>
        <div>
          <dt>{{ t('Inventory matches') }}</dt>
          <dd class="tabular accent-value">{{ matchedHostCount ?? '—' }}</dd>
        </div>
        <div>
          <dt>{{ t('Unmatched records') }}</dt>
          <dd class="tabular">{{ matchedHostCount === null ? '—' : knownHosts.length - matchedHostCount }}</dd>
        </div>
      </dl>
    </section>

    <section class="known-hosts-workspace">
      <div class="known-hosts-list panel">
        <header class="known-hosts-toolbar">
          <label class="known-hosts-search">
            <Search :size="17" aria-hidden="true" />
            <span class="sr-only">{{ t('Search Known Hosts') }}</span>
            <input
              v-model="search"
              type="search"
              :placeholder="t('Search host, algorithm, or fingerprint')"
              autocomplete="off"
            >
            <button
              v-if="search"
              type="button"
              :aria-label="t('Clear search')"
              @click="search = ''"
            >
              <X :size="16" aria-hidden="true" />
            </button>
          </label>
          <span class="known-hosts-count tabular">{{ filteredHosts.length }} / {{ knownHosts.length }}</span>
        </header>

        <div
          v-if="knownHostsLoading"
          class="loading-rows"
          :aria-label="t('Loading Known Hosts')"
          aria-busy="true"
        >
          <span v-for="index in 5" :key="index" />
        </div>

        <EmptyState
          v-else-if="!runtime.ready.value"
          :title="t('Host trust unavailable')"
          :description="t('Reconnect to the Hop instance to read and manage Known Hosts.')"
          :icon="ShieldOff"
          compact
        />

        <InlineNotice
          v-else-if="knownHostsQuery.isError.value && knownHosts.length === 0"
          class="query-error"
          tone="danger"
          :title="t('Known Hosts could not be loaded')"
        >
          {{ queryError || t('Check the instance connection and try again.') }}
          <template #actions>
            <BaseButton variant="secondary" @click="knownHostsQuery.refetch()">{{ t('Retry') }}</BaseButton>
          </template>
        </InlineNotice>

        <EmptyState
          v-else-if="knownHosts.length === 0"
          :title="t('No trusted target host keys')"
          :description="t('The first successful managed SSH connection records the target fingerprint here.')"
          :icon="ShieldCheck"
          compact
        />

        <EmptyState
          v-else-if="filteredHosts.length === 0"
          :title="t('No matching host keys')"
          :description="t('Try another host, algorithm, or fingerprint.')"
          :icon="Search"
          compact
        >
          <template #actions>
            <BaseButton variant="secondary" @click="search = ''">{{ t('Clear search') }}</BaseButton>
          </template>
        </EmptyState>

        <div v-else class="known-hosts-table">
          <div class="known-hosts-head" aria-hidden="true">
            <span>{{ t('Host') }}</span>
            <span>{{ t('Algorithm') }}</span>
            <span>{{ t('Fingerprint') }}</span>
            <span>{{ t('First trusted') }}</span>
            <span aria-hidden="true" />
          </div>
          <ul class="known-hosts-rows" :aria-label="t('Known Hosts')">
            <li v-for="host in filteredHosts" :key="hostKey(host)">
              <button
                class="known-host-row"
                :class="{ selected: hostKey(host) === selectedKey }"
                type="button"
                :aria-pressed="hostKey(host) === selectedKey"
                @click="selectHost(host)"
              >
                <span class="host-cell" :data-label="t('Host')">
                  <span class="host-mark" aria-hidden="true"><Server :size="16" /></span>
                  <span>
                    <strong>{{ host.hostname }}</strong>
                    <small class="tabular">{{ t('Port') }} {{ host.port }}</small>
                  </span>
                </span>
                <span class="key-type-cell mono" :data-label="t('Algorithm')">{{ host.keyType }}</span>
                <span class="fingerprint-cell mono" :data-label="t('Fingerprint')">{{ shortFingerprint(host.fingerprint) }}</span>
                <span class="first-seen-cell tabular" :data-label="t('First trusted')">{{ formatTimestamp(host.firstSeen) }}</span>
                <Fingerprint :size="17" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </div>
      </div>

      <aside class="known-host-detail panel" :aria-label="t('Known Host details')">
        <template v-if="selectedHost">
          <header class="detail-heading">
            <span class="detail-mark" aria-hidden="true"><ShieldCheck :size="20" /></span>
            <div>
              <h2>{{ selectedHost.hostname }}</h2>
              <p class="tabular">{{ hostAddress(selectedHost) }}</p>
            </div>
            <StatusBadge :label="t('Trusted')" tone="success" :icon="ShieldCheck" />
          </header>

          <dl class="detail-facts">
            <div>
              <dt>{{ t('Algorithm') }}</dt>
              <dd class="mono">{{ selectedHost.keyType }}</dd>
            </div>
            <div>
              <dt>{{ t('First trusted') }}</dt>
              <dd class="tabular">{{ formatTimestamp(selectedHost.firstSeen) }}</dd>
            </div>
            <div class="detail-facts__wide">
              <dt>{{ t('SHA256 fingerprint') }}</dt>
              <dd class="mono fingerprint-full">{{ selectedHost.fingerprint }}</dd>
            </div>
            <div class="detail-facts__wide">
              <dt>{{ t('Matching SSH assets') }}</dt>
              <dd v-if="assetsQuery.isPending.value">{{ t('Checking inventory matches…') }}</dd>
              <dd v-else-if="assetsQuery.isError.value">{{ t('Inventory matches unavailable') }}</dd>
              <dd v-else-if="selectedAssets?.length" class="asset-matches">
                <span v-for="asset in selectedAssets" :key="asset.id">{{ asset.name }}</span>
              </dd>
              <dd v-else>{{ t('No matching Catalog asset') }}</dd>
            </div>
          </dl>

          <InlineNotice tone="warning" :title="t('Verify before resetting trust')">
            {{ t('Reset only after confirming that this target was rebuilt or its SSH host key was intentionally rotated. The next managed connection will trust the key it receives.') }}
          </InlineNotice>

          <footer class="detail-actions">
            <BaseButton
              variant="danger"
              :disabled="!runtime.ready.value"
              @click="resetOpen = true"
            >
              <template #leading><Trash2 /></template>
              {{ t('Reset trust') }}
            </BaseButton>
          </footer>
        </template>

        <EmptyState
          v-else
          :title="t('Select a trusted host')"
          :description="t('Choose a row to inspect its complete fingerprint and inventory matches.')"
          :icon="CircleDotDashed"
          compact
        />
      </aside>
    </section>

    <ConfirmDialog
      v-model:open="resetOpen"
      :title="t('Reset this host trust?')"
      :description="selectedHost
        ? t('{target} will be removed from Known Hosts. This does not change the target machine.', { target: hostAddress(selectedHost) })
        : t('This Known Hosts record will be removed.')"
      :confirm-label="t('Reset trust')"
      :cancel-label="t('Keep trust')"
      :busy="resetMutation.isPending.value"
      @confirm="resetTrust"
    >
      <div v-if="selectedHost" class="reset-confirmation">
        <span aria-hidden="true"><ShieldOff :size="18" /></span>
        <p>
          <strong>{{ selectedHost.fingerprint }}</strong>
          {{ t('After removal, Hop will automatically establish trust in the host key presented by the next managed connection.') }}
        </p>
      </div>
    </ConfirmDialog>
  </section>
</template>

<style scoped>
.known-hosts-intro {
  align-items: center;
}

.icon-button {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  color: var(--text-muted);
  background: var(--surface-raised);
  cursor: pointer;
}

.icon-button:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--text-strong);
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.is-spinning {
  animation: known-hosts-spin 800ms linear infinite;
}

.trust-ledger {
  display: flex;
  min-height: 84px;
  align-items: stretch;
  justify-content: space-between;
  gap: 18px;
  overflow: hidden;
}

.trust-ledger__lead {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 15px 18px;
}

.trust-ledger__mark,
.detail-mark,
.host-mark {
  display: grid;
  place-items: center;
  color: var(--accent-strong);
  background: var(--accent-soft);
}

.trust-ledger__mark {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 10px;
}

.trust-ledger__lead strong,
.trust-ledger__lead small {
  display: block;
}

.trust-ledger__lead strong {
  color: var(--text-strong);
  font-size: 15px;
}

.trust-ledger__lead small {
  max-width: 66ch;
  margin-top: 3px;
  color: var(--text-muted);
}

.trust-ledger dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(118px, 1fr));
  min-width: 280px;
  margin: 0;
  border-left: 1px solid var(--line);
}

.trust-ledger dl div {
  display: grid;
  align-content: center;
  gap: 2px;
  padding: 12px 16px;
}

.trust-ledger dl div + div {
  border-left: 1px solid var(--line);
}

.trust-ledger dt {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
}

.trust-ledger dd {
  margin: 0;
  color: var(--text-strong);
  font-size: 18px;
  font-weight: 650;
}

.trust-ledger .accent-value {
  color: var(--accent-strong);
}

.known-hosts-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.62fr);
  gap: 12px;
  min-height: 520px;
}

.known-hosts-list,
.known-host-detail {
  min-width: 0;
  overflow: hidden;
}

.known-hosts-toolbar {
  display: flex;
  min-height: 60px;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}

.known-hosts-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 44px;
  padding: 0 8px 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  color: var(--text-muted);
  background: var(--surface-input);
}

.known-hosts-search:focus-within {
  border-color: var(--focus);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus) 24%, transparent);
}

.known-hosts-search input {
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  color: var(--text-strong);
  background: transparent;
}

.known-hosts-search button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 7px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}

.known-hosts-search button:hover {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.known-hosts-count {
  color: var(--text-muted);
  font-size: 12px;
}

.known-hosts-head,
.known-host-row {
  display: grid;
  grid-template-columns: minmax(145px, 1.1fr) minmax(115px, 0.86fr) minmax(180px, 1.35fr) minmax(112px, 0.78fr) 18px;
  align-items: center;
  gap: 14px;
}

.known-hosts-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.known-hosts-head {
  min-height: 36px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.known-host-row {
  width: 100%;
  min-height: 64px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.known-host-row:hover {
  background: var(--surface-hover);
}

.known-host-row.selected {
  background: var(--surface-selected);
  box-shadow: inset 2px 0 var(--accent);
}

.known-host-row > svg {
  color: var(--text-muted);
}

.host-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.host-mark {
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  border-radius: 8px;
}

.host-cell strong,
.host-cell small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.host-cell strong {
  color: var(--text-strong);
  font-weight: 650;
}

.host-cell small,
.first-seen-cell {
  color: var(--text-muted);
  font-size: 12px;
}

.key-type-cell,
.fingerprint-cell,
.first-seen-cell {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fingerprint-cell {
  color: var(--text-strong);
  font-size: 12px;
}

.known-host-detail {
  display: flex;
  flex-direction: column;
}

.detail-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 18px;
  border-bottom: 1px solid var(--line);
}

.detail-mark {
  width: 38px;
  height: 38px;
  border-radius: 9px;
}

.detail-heading h2,
.detail-heading p {
  margin: 0;
}

.detail-heading h2 {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-heading p {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 12px;
}

.detail-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 6px 18px;
}

.detail-facts > div {
  min-width: 0;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
}

.detail-facts > div:nth-child(odd):not(.detail-facts__wide) {
  padding-right: 14px;
}

.detail-facts > div:nth-child(even):not(.detail-facts__wide) {
  padding-left: 14px;
  border-left: 1px solid var(--line);
}

.detail-facts__wide {
  grid-column: 1 / -1;
}

.detail-facts dt {
  margin-bottom: 5px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
}

.detail-facts dd {
  margin: 0;
  color: var(--text-strong);
}

.fingerprint-full {
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.55;
}

.asset-matches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.asset-matches span {
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--text);
  background: var(--surface-raised);
  font-size: 12px;
}

.known-host-detail > :deep(.inline-notice) {
  margin: 12px 18px 0;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding: 16px 18px;
  border-top: 1px solid var(--line);
}

.loading-rows {
  display: grid;
}

.loading-rows span {
  min-height: 64px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-raised);
  animation: known-hosts-loading 1.3s ease-in-out infinite;
}

.query-error {
  margin: 14px;
}

.reset-confirmation {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--warning) 36%, var(--line));
  border-radius: var(--radius-control);
  color: var(--warning);
  background: var(--warning-soft);
}

.reset-confirmation p {
  margin: 0;
}

.reset-confirmation strong {
  display: block;
  margin-bottom: 5px;
  overflow-wrap: anywhere;
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 12px;
}

@keyframes known-hosts-spin {
  to { transform: rotate(360deg); }
}

@keyframes known-hosts-loading {
  50% { opacity: 0.48; }
}

@media (max-width: 1180px) {
  .known-hosts-workspace {
    grid-template-columns: minmax(0, 1fr) 330px;
  }

  .known-hosts-head,
  .known-host-row {
    grid-template-columns: minmax(145px, 1fr) minmax(110px, 0.8fr) minmax(150px, 1fr) 18px;
  }

  .known-hosts-head span:nth-child(4),
  .known-host-row .first-seen-cell {
    display: none;
  }
}

@media (max-width: 899px) {
  .trust-ledger {
    display: grid;
  }

  .trust-ledger dl {
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .known-hosts-workspace {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }

  .known-host-detail {
    min-height: 390px;
  }
}

@media (max-width: 620px) {
  .known-hosts-head {
    display: none;
  }

  .known-host-row {
    grid-template-columns: minmax(0, 1fr) 18px;
    gap: 8px 12px;
    padding-block: 12px;
  }

  .known-host-row > span {
    grid-column: 1;
  }

  .known-host-row > svg {
    grid-column: 2;
    grid-row: 1;
  }

  .key-type-cell,
  .fingerprint-cell,
  .first-seen-cell {
    display: grid !important;
    grid-template-columns: 84px minmax(0, 1fr);
    gap: 8px;
    white-space: normal;
  }

  .key-type-cell::before,
  .fingerprint-cell::before,
  .first-seen-cell::before {
    color: var(--text-muted);
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 650;
    content: attr(data-label);
  }

  .fingerprint-cell {
    overflow-wrap: anywhere;
  }

  .trust-ledger dl {
    min-width: 0;
  }

  .detail-heading {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .detail-heading :deep(.status-badge) {
    grid-column: 2;
    justify-self: start;
  }

  .detail-facts {
    grid-template-columns: minmax(0, 1fr);
  }

  .detail-facts > div,
  .detail-facts > div:nth-child(odd):not(.detail-facts__wide),
  .detail-facts > div:nth-child(even):not(.detail-facts__wide) {
    grid-column: 1;
    padding-inline: 0;
    border-left: 0;
  }

  .detail-actions :deep(.base-button) {
    width: 100%;
  }
}
</style>
