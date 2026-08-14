<script setup lang="ts">
import {
  ArrowRight,
  Boxes,
  CircleCheck,
  CircleGauge,
  Clock3,
  KeyRound,
  Server,
  ShieldCheck,
  TriangleAlert,
} from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { InlineNotice, StatusBadge } from '@/components/ui'
import {
  useAccessKeysQuery,
  useAssetsQuery,
  useConfigStatusQuery,
  useCredentialsQuery,
  useSessionsQuery,
  useStatusQuery,
} from '@/queries'
import { useConnection } from '@/stores/connection'
import { formatDuration, formatRelativeTime, pluralize } from '@/utils/format'

const connection = useConnection()
const statusQuery = useStatusQuery()
const assetsQuery = useAssetsQuery()
const credentialsQuery = useCredentialsQuery()
const accessKeysQuery = useAccessKeysQuery()
const sessionsQuery = useSessionsQuery()
const configQuery = useConfigStatusQuery()

const activeSessions = computed(
  () => sessionsQuery.data.value?.filter((session) => session.status === 'started') ?? [],
)

const sshCount = computed(
  () => assetsQuery.data.value?.filter((asset) => asset.protocol === 'ssh').length ?? 0,
)
const tcpCount = computed(
  () => assetsQuery.data.value?.filter((asset) => asset.protocol === 'tcp').length ?? 0,
)

const attentionItems = computed(() => {
  const items: Array<{ key: string; kind: string; name: string; message: string; time: string | null }> = []
  for (const source of configQuery.data.value?.sources ?? []) {
    if (source.lastErrorCode !== null) {
      items.push({
        key: `source-${source.sourceId}`,
        kind: 'Source error',
        name: source.sourceId,
        message: source.lastErrorMessage ?? source.lastErrorCode,
        time: source.lastErrorAt,
      })
    }
  }
  for (const orphan of configQuery.data.value?.orphans ?? []) {
    items.push({
      key: `orphan-${orphan.sourceId}-${orphan.sourceKey}`,
      kind: 'Orphan',
      name: orphan.sourceKey,
      message: `${orphan.resourceType} from ${orphan.sourceId} is no longer declared`,
      time: orphan.orphanedAt,
    })
  }
  if (connection.isDemo.value) {
    for (const asset of assetsQuery.data.value ?? []) {
      if (asset.health?.status === 'failed') {
        items.push({
          key: `asset-${asset.id}`,
          kind: 'Demo health',
          name: asset.name,
          message: asset.health.errorMessage ?? 'Synthetic connection check failed',
          time: asset.health.checkedAt,
        })
      }
    }
  }
  return items
})

const recentSessions = computed(() => sessionsQuery.data.value?.slice(0, 4) ?? [])
const pageError = computed(
  () =>
    statusQuery.error.value ??
    assetsQuery.error.value ??
    credentialsQuery.error.value ??
    accessKeysQuery.error.value ??
    sessionsQuery.error.value ??
    configQuery.error.value,
)

const resourceSummary = computed(() => [
  { label: 'SSH assets', count: sshCount.value, icon: Server, to: '/assets?protocol=ssh' },
  { label: 'TCP assets', count: tcpCount.value, icon: Boxes, to: '/assets?protocol=tcp' },
  { label: 'Credentials', count: credentialsQuery.data.value?.length ?? 0, icon: KeyRound, to: '/credentials' },
  { label: 'Access keys', count: accessKeysQuery.data.value?.length ?? 0, icon: ShieldCheck, to: '/access' },
])
</script>

<template>
  <section class="overview page-stack" aria-labelledby="overview-summary">
    <InlineNotice v-if="pageError" tone="danger" title="Some instance data could not be loaded">
      <p>{{ pageError instanceof Error ? pageError.message : 'Refresh the page or check the instance connection.' }}</p>
    </InlineNotice>

    <section class="status-spine panel" :aria-busy="statusQuery.isPending.value">
      <div class="status-lead">
        <span class="status-icon" :class="{ 'has-error': Boolean(statusQuery.error.value) || connection.state.mode === 'reauth' }" aria-hidden="true">
          <CircleCheck v-if="!statusQuery.error.value && connection.state.mode !== 'reauth'" :size="27" />
          <TriangleAlert v-else :size="27" />
        </span>
        <div>
          <h2 id="overview-summary">
            {{ connection.state.mode === 'reauth' ? 'Authentication required' : statusQuery.error.value ? 'Connection needs attention' : statusQuery.isPending.value ? 'Reading instance…' : 'API connected' }}
          </h2>
          <p>{{ connection.state.mode === 'reauth' ? 'Reconnect to read the saved instance' : statusQuery.error.value ? 'Catalog state is unavailable' : 'Control API and Catalog are available' }}</p>
        </div>
      </div>

      <dl class="status-facts tabular">
        <div>
          <dt>Version</dt>
          <dd>{{ statusQuery.data.value?.version ?? '—' }}</dd>
        </div>
        <div>
          <dt>Catalog</dt>
          <dd>r{{ statusQuery.data.value?.catalogRevision ?? '—' }}</dd>
        </div>
        <div>
          <dt>Recent active</dt>
          <dd class="accent-value">{{ pluralize(activeSessions.length, 'session') }}</dd>
        </div>
      </dl>
    </section>

    <nav class="resource-strip panel" aria-label="Catalog resources">
      <RouterLink v-for="resource in resourceSummary" :key="resource.label" :to="resource.to" class="resource-stat">
        <component :is="resource.icon" :size="20" :stroke-width="1.7" aria-hidden="true" />
        <span>
          <small>{{ resource.label }}</small>
          <strong class="tabular">{{ resource.count }}</strong>
        </span>
        <ArrowRight :size="16" aria-hidden="true" />
      </RouterLink>
    </nav>

    <div class="overview-grid">
      <div class="overview-main">
        <section class="section-panel panel">
          <header class="section-heading">
            <div>
              <h2>Needs attention</h2>
              <p>Configuration facts the API can verify.</p>
            </div>
            <RouterLink to="/configuration">Configuration <ArrowRight :size="15" /></RouterLink>
          </header>

          <div v-if="attentionItems.length" class="attention-list">
            <RouterLink v-for="item in attentionItems" :key="item.key" to="/configuration" class="attention-row">
              <StatusBadge :label="item.kind" tone="warning" />
              <span class="attention-name">{{ item.name }}</span>
              <span class="attention-message">{{ item.message }}</span>
              <time class="tabular">{{ formatRelativeTime(item.time) }}</time>
            </RouterLink>
          </div>
          <div v-else class="quiet-state">
            <CircleCheck :size="20" aria-hidden="true" />
            <span><strong>No reported configuration problems</strong><small>Sources have no current error and no resources are orphaned.</small></span>
          </div>
        </section>

        <section class="section-panel panel">
          <header class="section-heading">
            <div>
              <h2>Recent sessions</h2>
              <p>The latest records returned by this instance.</p>
            </div>
            <RouterLink to="/sessions">All sessions <ArrowRight :size="15" /></RouterLink>
          </header>

          <div class="session-table" role="table" aria-label="Recent sessions">
            <div class="session-head" role="row">
              <span role="columnheader">Started</span><span role="columnheader">Asset</span><span role="columnheader">Mode</span><span role="columnheader">Key</span><span role="columnheader">Duration</span><span role="columnheader">Status</span>
            </div>
            <RouterLink v-for="session in recentSessions" :key="session.id" to="/sessions" class="session-row" role="row">
              <time class="tabular" role="cell">{{ formatRelativeTime(session.startedAt) }}</time>
              <strong role="cell">{{ session.assetName ?? session.targetHost ?? 'Unknown target' }}</strong>
              <span role="cell">{{ session.mode }}</span>
              <span role="cell">{{ session.keyName ?? session.keyFingerprint }}</span>
              <span class="tabular" role="cell">{{ formatDuration(session.startedAt, session.endedAt) }}</span>
              <StatusBadge :label="session.status === 'started' ? 'Active' : session.status" :tone="session.status === 'started' || session.status === 'ok' ? 'success' : 'danger'" />
            </RouterLink>
            <div v-if="recentSessions.length === 0" class="quiet-state">
              <Clock3 :size="20" aria-hidden="true" />
              <span><strong>No session records</strong><small>Recent connections will appear here.</small></span>
            </div>
          </div>
        </section>
      </div>

      <aside class="overview-side">
        <section class="section-panel panel catalog-panel">
          <header class="section-heading">
            <div>
              <h2>Catalog snapshot</h2>
              <p>Inventory at revision {{ configQuery.data.value?.revision ?? '—' }}.</p>
            </div>
          </header>
          <dl class="catalog-list">
            <div><dt>Total assets</dt><dd class="tabular">{{ assetsQuery.data.value?.length ?? 0 }}</dd></div>
            <div><dt>Credentials</dt><dd class="tabular">{{ credentialsQuery.data.value?.length ?? 0 }}</dd></div>
            <div><dt>Access keys</dt><dd class="tabular">{{ accessKeysQuery.data.value?.length ?? 0 }}</dd></div>
            <div><dt>Manifest schema</dt><dd class="mono">{{ configQuery.data.value?.manifestApiVersion ?? '—' }}</dd></div>
          </dl>
        </section>

        <section class="section-panel panel sources-panel">
          <header class="section-heading">
            <div>
              <h2>Configuration sources</h2>
              <p>{{ pluralize(configQuery.data.value?.sources.length ?? 0, 'source') }}</p>
            </div>
          </header>
          <div class="source-list">
            <div v-for="source in configQuery.data.value?.sources ?? []" :key="source.sourceId" class="source-row">
              <span><strong>{{ source.sourceId }}</strong><small>generation {{ source.generation }}</small></span>
              <StatusBadge :label="source.lastErrorCode ? 'Error' : 'Current'" :tone="source.lastErrorCode ? 'danger' : 'success'" />
            </div>
            <div v-if="!configQuery.data.value?.sources.length" class="quiet-state compact">
              <CircleGauge :size="19" aria-hidden="true" />
              <span><strong>No configured sources</strong><small>Local Catalog resources remain available.</small></span>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <p v-if="connection.isDemo.value" class="demo-disclosure">
      Demo workspace · resource ownership and asset checks on this page are synthetic examples, not live measurements.
    </p>
  </section>
</template>

<style scoped>
.overview {
  gap: 12px;
}

.status-spine {
  display: grid;
  min-height: 106px;
  grid-template-columns: minmax(270px, 1.1fr) minmax(440px, 1.9fr);
  align-items: stretch;
  overflow: hidden;
}

.status-lead {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
}

.status-icon {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 1px solid var(--accent);
  border-radius: 50%;
  color: var(--accent);
  background: var(--accent-soft);
}

.status-icon.has-error {
  border-color: var(--danger);
  color: var(--danger);
  background: var(--danger-soft);
}

.status-lead h2,
.section-heading h2 {
  margin: 0;
  color: var(--text-strong);
  font-weight: 620;
  letter-spacing: -0.02em;
}

.status-lead h2 {
  font-size: 20px;
}

.status-lead p,
.section-heading p {
  margin: 3px 0 0;
  color: var(--text-muted);
}

.status-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.status-facts > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 18px 22px;
  border-left: 1px solid var(--line);
}

.status-facts dt {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.status-facts dd {
  margin: 6px 0 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-facts .accent-value {
  color: var(--accent-strong);
}

.resource-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
}

.resource-stat {
  display: grid;
  min-width: 0;
  min-height: 86px;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 13px;
  padding: 15px 20px;
  color: var(--text-muted);
  text-decoration: none;
}

.resource-stat + .resource-stat {
  border-left: 1px solid var(--line);
}

.resource-stat:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.resource-stat span {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.resource-stat small {
  color: var(--text);
}

.resource-stat strong {
  color: var(--text-strong);
  font-size: 20px;
  font-weight: 650;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(300px, 0.75fr);
  gap: 12px;
}

.overview-main,
.overview-side {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
}

.section-panel {
  min-width: 0;
  overflow: hidden;
}

.section-heading {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 20px;
  border-bottom: 1px solid var(--line);
}

.section-heading h2 {
  font-size: 16px;
}

.section-heading p {
  font-size: 12px;
}

.section-heading a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--info);
  text-decoration: none;
  white-space: nowrap;
}

.attention-list {
  display: grid;
}

.attention-row {
  display: grid;
  min-height: 54px;
  grid-template-columns: 118px minmax(110px, 0.45fr) minmax(180px, 1fr) 76px;
  align-items: center;
  gap: 12px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  text-decoration: none;
}

.attention-row:last-child {
  border-bottom: 0;
}

.attention-row:hover,
.session-row:hover {
  background: var(--surface-hover);
}

.attention-name {
  overflow: hidden;
  color: var(--text-strong);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-message {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-row time {
  color: var(--text-muted);
  font-size: 12px;
  text-align: right;
}

.session-table {
  display: grid;
}

.session-head,
.session-row {
  display: grid;
  grid-template-columns: 90px minmax(130px, 1.1fr) minmax(80px, 0.7fr) minmax(120px, 1fr) 74px 88px;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
}

.session-head {
  min-height: 38px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.session-row {
  min-height: 54px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  text-decoration: none;
}

.session-row:last-child {
  border-bottom: 0;
}

.session-row > * {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-row strong {
  color: var(--text-strong);
  font-weight: 590;
}

.quiet-state {
  display: flex;
  min-height: 90px;
  align-items: center;
  gap: 12px;
  justify-content: center;
  padding: 18px;
  color: var(--accent);
}

.quiet-state.compact {
  min-height: 72px;
}

.quiet-state span {
  display: grid;
}

.quiet-state strong {
  color: var(--text-strong);
  font-weight: 600;
}

.quiet-state small {
  color: var(--text-muted);
}

.catalog-list {
  display: grid;
  margin: 0;
  padding: 8px 18px 14px;
}

.catalog-list > div,
.source-row {
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--line);
}

.catalog-list > div:last-child,
.source-row:last-child {
  border-bottom: 0;
}

.catalog-list dt {
  color: var(--text-muted);
}

.catalog-list dd {
  margin: 0;
  color: var(--text-strong);
}

.source-list {
  padding: 0 18px 10px;
}

.source-row span {
  display: grid;
}

.source-row strong {
  color: var(--text-strong);
}

.source-row small {
  color: var(--text-muted);
}

.demo-disclosure {
  margin: 2px 2px 0;
  color: var(--text-muted);
  font-size: 12px;
}

@media (max-width: 1199px) {
  .status-spine {
    grid-template-columns: 1fr;
  }

  .status-facts {
    border-top: 1px solid var(--line);
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .overview-side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .status-lead {
    padding: 16px;
  }

  .status-facts > div {
    padding: 14px 12px;
  }

  .status-facts dd {
    font-size: 17px;
  }

  .resource-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .resource-stat:nth-child(3) {
    border-left: 0;
  }

  .resource-stat:nth-child(n + 3) {
    border-top: 1px solid var(--line);
  }

  .attention-row {
    grid-template-columns: 1fr auto;
    gap: 6px 12px;
    padding: 10px 14px;
  }

  .attention-row :deep(.status-badge) {
    justify-self: start;
  }

  .attention-name {
    justify-self: end;
  }

  .attention-message {
    grid-column: 1 / -1;
    white-space: normal;
  }

  .attention-row time {
    display: none;
  }

  .session-head {
    display: none;
  }

  .session-row {
    grid-template-columns: 1fr auto;
    gap: 3px 12px;
    padding: 10px 14px;
  }

  .session-row > :nth-child(1),
  .session-row > :nth-child(3),
  .session-row > :nth-child(4) {
    display: none;
  }

  .session-row > :nth-child(5) {
    grid-column: 1;
    grid-row: 2;
    color: var(--text-muted);
  }

  .session-row > :nth-child(6) {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .overview-side {
    grid-template-columns: 1fr;
  }
}
</style>
