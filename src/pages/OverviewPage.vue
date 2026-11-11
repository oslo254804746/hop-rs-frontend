<script setup lang="ts">
import {
  Activity,
  ArrowRight,
  Boxes,
  CircleCheck,
  CircleGauge,
  Clock3,
  KeyRound,
  Server,
  ShieldCheck,
  SquareTerminal,
  TriangleAlert,
} from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { getPanelRuntimeConfig } from '@/api'
import SshConfigDialog from '@/components/assets/SshConfigDialog.vue'
import { BaseButton, InlineNotice, StatusBadge } from '@/components/ui'
import { useI18n } from '@/i18n'
import {
  useAccessKeysQuery,
  useAssetsQuery,
  useAuditEventsQuery,
  useCredentialsQuery,
  useHopApiRuntime,
  useProbeAssetsMutation,
  useSessionsQuery,
  useStatusQuery,
} from '@/queries'
import { useConnection } from '@/stores/connection'
import { formatDuration, formatRelativeTime } from '@/utils/format'

const connection = useConnection()
const runtime = useHopApiRuntime()
const statusQuery = useStatusQuery()
const assetsQuery = useAssetsQuery()
const credentialsQuery = useCredentialsQuery()
const accessKeysQuery = useAccessKeysQuery()
const sessionsQuery = useSessionsQuery()
const auditEventsQuery = useAuditEventsQuery()
const probeAllMutation = useProbeAssetsMutation()
const { t } = useI18n()
const isOpenWrt = getPanelRuntimeConfig().deployment === 'openwrt'

const sshConfigOpen = ref(false)

const activeSessions = computed(
  () => sessionsQuery.data.value?.filter((session) => session.status === 'started') ?? [],
)

const sshCount = computed(
  () => assetsQuery.data.value?.filter((asset) => asset.protocol === 'ssh').length ?? 0,
)
const tcpCount = computed(
  () => assetsQuery.data.value?.filter((asset) => asset.protocol === 'tcp').length ?? 0,
)

const fleetHealth = computed(() => {
  const list = assetsQuery.data.value ?? []
  const healthy = list.filter((asset) => asset.health?.status === 'healthy')
  const failed = list.filter((asset) => asset.health?.status === 'failed')
  const latencies = healthy
    .map((asset) => (asset.health?.status === 'healthy' ? asset.health.latencyMs : null))
    .filter((ms): ms is number => ms !== null)
  const avgMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length)
      : null
  return {
    total: list.length,
    healthy: healthy.length,
    failed: failed.length,
    avgMs,
  }
})

const attentionItems = computed(() => {
  const items: Array<{
    key: string
    kind: string
    tone: 'warning' | 'danger'
    name: string
    message: string
    time: string | null
    to: string
  }> = []
  for (const asset of assetsQuery.data.value ?? []) {
    if (asset.protocol === 'ssh' && asset.credentialId === null) {
      items.push({
        key: `credential-${asset.id}`,
        kind: t('Credential'),
        tone: 'warning',
        name: asset.name,
        message: t('This SSH asset has no target credential.'),
        time: asset.updatedAt,
        to: `/assets?asset=${encodeURIComponent(asset.id)}`,
      })
    }
    if (asset.health?.status === 'failed') {
      items.push({
        key: `asset-${asset.id}`,
        kind: connection.isDemo.value ? t('Demo health') : t('Reachability'),
        tone: 'danger',
        name: asset.name,
        message: asset.health.errorMessage ?? t('Target probe failed'),
        time: asset.health.checkedAt,
        to: `/assets?asset=${encodeURIComponent(asset.id)}`,
      })
    }
  }
  return items
})

const recentSessions = computed(() => sessionsQuery.data.value?.slice(0, 4) ?? [])
const recentAuditEvents = computed(() => auditEventsQuery.data.value?.slice(0, 4) ?? [])

const pageError = computed(
  () =>
    statusQuery.error.value ??
    assetsQuery.error.value ??
    credentialsQuery.error.value ??
    accessKeysQuery.error.value ??
    sessionsQuery.error.value,
)

const ownershipCounts = computed(() => {
  const resources = [
    ...(assetsQuery.data.value ?? []),
    ...(credentialsQuery.data.value ?? []),
    ...(accessKeysQuery.data.value ?? []),
  ]
  return {
    local: resources.filter((resource) => resource.management?.mode !== 'config').length,
    config: resources.filter((resource) => resource.management?.mode === 'config').length,
  }
})

const resourceSummary = computed(() => [
  { label: t('SSH assets'), count: sshCount.value, icon: Server, to: '/assets?protocol=ssh' },
  { label: t('TCP assets'), count: tcpCount.value, icon: Boxes, to: '/assets?protocol=tcp' },
  {
    label: t('Credentials'),
    count: credentialsQuery.data.value?.length ?? 0,
    icon: KeyRound,
    to: '/credentials',
  },
  {
    label: t('Access keys'),
    count: accessKeysQuery.data.value?.length ?? 0,
    icon: ShieldCheck,
    to: '/access',
  },
])
</script>

<template>
  <div class="overview-page page-stack">
    <header class="page-intro">
      <div>
        <h1>{{ t('Overview') }}</h1>
        <p>{{ t('Overview intro description') }}</p>
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
          :disabled="!runtime.ready.value || fleetHealth.total === 0"
          :loading="probeAllMutation.isPending.value"
          :loading-label="t('Probing…')"
          @click="void probeAllMutation.mutateAsync()"
        >
          <template #leading><Activity /></template>
          {{ t('Probe fleet') }}
        </BaseButton>
      </div>
    </header>

    <section class="overview page-stack" aria-labelledby="overview-summary">
      <InlineNotice v-if="pageError" tone="danger" :title="t('Some instance data could not be loaded')">
        <p>{{ pageError instanceof Error ? pageError.message : t('Refresh the page or check the instance connection.') }}</p>
      </InlineNotice>

      <section class="status-spine panel" :aria-busy="statusQuery.isPending.value">
        <div class="status-lead">
          <span
            class="status-icon"
            :class="{ 'has-error': Boolean(statusQuery.error.value) || connection.state.mode === 'reauth' }"
            aria-hidden="true"
          >
            <CircleCheck v-if="!statusQuery.error.value && connection.state.mode !== 'reauth'" :size="22" />
            <TriangleAlert v-else :size="22" />
          </span>
          <div>
            <h2 id="overview-summary">
              {{ connection.state.mode === 'reauth' ? t('Authentication required') : statusQuery.error.value ? t('Connection needs attention') : statusQuery.isPending.value ? t('Reading instance…') : t('API connected') }}
            </h2>
            <p>{{ connection.state.mode === 'reauth' ? t('Reconnect to read the saved instance') : statusQuery.error.value ? t('Catalog state is unavailable') : t('Control API and Catalog are available') }}</p>
          </div>
        </div>

        <dl class="status-facts tabular">
          <div>
            <dt>{{ t('Version') }}</dt>
            <dd class="mono">{{ statusQuery.data.value?.version ?? '—' }}</dd>
          </div>
          <div>
            <dt>Catalog</dt>
            <dd class="mono">r{{ statusQuery.data.value?.catalogRevision ?? '—' }}</dd>
          </div>
          <div>
            <dt>{{ t('Reachable targets') }}</dt>
            <dd>
              <span>{{ fleetHealth.healthy }} / {{ fleetHealth.total }}</span>
              <small v-if="fleetHealth.avgMs !== null" class="fact-sub mono">~{{ fleetHealth.avgMs }} ms</small>
            </dd>
          </div>
          <div>
            <dt>{{ t('Recent active') }}</dt>
            <dd class="accent-value">{{ t('{count} active sessions', { count: activeSessions.length }) }}</dd>
          </div>
        </dl>
      </section>

      <nav class="resource-strip panel" :aria-label="t('Catalog resources')">
        <RouterLink v-for="resource in resourceSummary" :key="resource.label" :to="resource.to" class="resource-stat">
          <span class="resource-icon" aria-hidden="true">
            <component :is="resource.icon" :size="18" :stroke-width="1.8" />
          </span>
          <span>
            <small>{{ resource.label }}</small>
            <strong class="tabular">{{ resource.count }}</strong>
          </span>
          <ArrowRight :size="15" aria-hidden="true" />
        </RouterLink>
      </nav>

      <div class="overview-grid">
        <div class="overview-main">
          <section class="section-panel panel">
            <header class="section-heading">
              <div>
                <h2>{{ t('Needs attention') }}</h2>
                <p>{{ t('Catalog records that need a safe next action.') }}</p>
              </div>
              <RouterLink to="/assets">{{ t('Assets') }} <ArrowRight :size="14" /></RouterLink>
            </header>

            <div v-if="attentionItems.length" class="attention-list">
              <RouterLink v-for="item in attentionItems" :key="item.key" :to="item.to" class="attention-row">
                <StatusBadge :label="item.kind" :tone="item.tone" />
                <span class="attention-name">{{ item.name }}</span>
                <span class="attention-message">{{ item.message }}</span>
                <time class="tabular">{{ formatRelativeTime(item.time) }}</time>
              </RouterLink>
            </div>
            <div v-else class="quiet-state">
              <CircleCheck :size="19" aria-hidden="true" />
              <span>
                <strong>{{ t('No Catalog action needed') }}</strong>
                <small>{{ t('Every SSH asset has a target credential.') }}</small>
              </span>
            </div>
          </section>

          <section class="section-panel panel">
            <header class="section-heading">
              <div>
                <h2>{{ t('Recent sessions') }}</h2>
                <p>{{ t('The latest records returned by this instance.') }}</p>
              </div>
              <RouterLink to="/sessions">{{ t('All sessions') }} <ArrowRight :size="14" /></RouterLink>
            </header>

            <div class="session-table" role="table" :aria-label="t('Recent sessions')">
              <div class="session-head" role="row">
                <span role="columnheader">{{ t('Started') }}</span>
                <span role="columnheader">{{ t('Asset') }}</span>
                <span role="columnheader">{{ t('Mode') }}</span>
                <span role="columnheader">{{ t('Key') }}</span>
                <span role="columnheader">{{ t('Duration') }}</span>
                <span role="columnheader">{{ t('Status') }}</span>
              </div>
              <RouterLink
                v-for="session in recentSessions"
                :key="session.id"
                to="/sessions"
                class="session-row"
                role="row"
              >
                <time class="tabular" role="cell">{{ formatRelativeTime(session.startedAt) }}</time>
                <strong role="cell">{{ session.assetName ?? session.targetHost ?? t('Unknown target') }}</strong>
                <span class="mono" role="cell">{{ session.mode }}</span>
                <span role="cell">{{ session.keyName ?? session.keyFingerprint }}</span>
                <span class="tabular mono" role="cell">{{ formatDuration(session.startedAt, session.endedAt) }}</span>
                <StatusBadge
                  :label="session.status === 'started' ? t('Active') : session.status"
                  :tone="session.status === 'started' || session.status === 'ok' ? 'success' : 'danger'"
                />
              </RouterLink>
              <div v-if="recentSessions.length === 0" class="quiet-state">
                <Clock3 :size="19" aria-hidden="true" />
                <span>
                  <strong>{{ t('No session records') }}</strong>
                  <small>{{ t('Recent connections will appear here.') }}</small>
                </span>
              </div>
            </div>
          </section>
        </div>

        <aside class="overview-side">
          <section class="section-panel panel catalog-panel">
            <header class="section-heading">
              <div>
                <h2>{{ t('Catalog snapshot') }}</h2>
                <p>{{ t('Catalog at current revision') }} {{ statusQuery.data.value?.catalogRevision ?? '—' }}.</p>
              </div>
            </header>
            <dl class="catalog-list">
              <div><dt>{{ t('Total assets') }}</dt><dd class="tabular">{{ assetsQuery.data.value?.length ?? 0 }}</dd></div>
              <div><dt>{{ t('Credentials') }}</dt><dd class="tabular">{{ credentialsQuery.data.value?.length ?? 0 }}</dd></div>
              <div><dt>{{ t('Access keys') }}</dt><dd class="tabular">{{ accessKeysQuery.data.value?.length ?? 0 }}</dd></div>
              <div><dt>{{ t('Active sessions') }}</dt><dd class="tabular">{{ activeSessions.length }}</dd></div>
            </dl>
          </section>

          <section v-if="recentAuditEvents.length > 0" class="section-panel panel">
            <header class="section-heading">
              <div>
                <h2>{{ t('Recent audit activity') }}</h2>
                <p>{{ t('Latest mutations and probes recorded by Hop.') }}</p>
              </div>
              <RouterLink to="/audit">{{ t('All audit events') }} <ArrowRight :size="14" /></RouterLink>
            </header>
            <div class="audit-mini-list">
              <RouterLink
                v-for="event in recentAuditEvents"
                :key="event.id"
                to="/audit"
                class="audit-mini-row"
              >
                <span class="audit-mini-main">
                  <code class="mono">{{ event.action }}</code>
                  <small>{{ event.targetLabel || event.targetType }} · {{ event.actorLabel }}</small>
                </span>
                <time class="tabular">{{ formatRelativeTime(event.occurredAt) }}</time>
              </RouterLink>
            </div>
          </section>

          <section class="section-panel panel sources-panel">
            <header class="section-heading">
              <div>
                <h2>{{ t('Management boundary') }}</h2>
                <p>{{ t(isOpenWrt ? 'OpenWrt management boundary explanation' : 'Edit panel resources here; edit configuration resources in hop.yaml.') }}</p>
              </div>
              <RouterLink to="/configuration">{{ t('Settings') }} <ArrowRight :size="14" /></RouterLink>
            </header>
            <div class="source-list">
              <div class="source-row">
                <span><strong>{{ t('Panel / local') }}</strong><small>{{ t('Editable in this workspace') }}</small></span>
                <StatusBadge :label="String(ownershipCounts.local)" tone="success" />
              </div>
              <div class="source-row">
                <span><strong>{{ t('Configuration file') }}</strong><small>{{ t('Read-only in the panel') }}</small></span>
                <StatusBadge :label="String(ownershipCounts.config)" tone="info" />
              </div>
              <div v-if="ownershipCounts.local + ownershipCounts.config === 0" class="quiet-state compact">
                <CircleGauge :size="18" aria-hidden="true" />
                <span><strong>{{ t('Empty Catalog') }}</strong><small>{{ t('Add your first resource from the panel.') }}</small></span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <p v-if="connection.isDemo.value" class="demo-disclosure">
        {{ t('Demo workspace disclosure') }}
      </p>
    </section>

    <SshConfigDialog
      v-model:open="sshConfigOpen"
      :assets="assetsQuery.data.value ?? []"
      :credentials="credentialsQuery.data.value ?? []"
    />
  </div>
</template>

<style scoped>
.overview {
  gap: 14px;
}

.status-spine {
  display: grid;
  min-height: 92px;
  grid-template-columns: minmax(260px, 1fr) minmax(480px, 1.9fr);
  align-items: stretch;
  overflow: hidden;
}

.status-lead {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
}

.status-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--line));
  border-radius: 10px;
  color: var(--accent-strong);
  background: var(--accent-soft);
}

.status-icon.has-error {
  border-color: color-mix(in srgb, var(--danger) 42%, var(--line));
  color: var(--danger);
  background: var(--danger-soft);
}

.status-lead h2,
.section-heading h2 {
  margin: 0;
  color: var(--text-strong);
  font-weight: 640;
  letter-spacing: -0.02em;
}

.status-lead h2 {
  font-size: 17px;
}

.status-lead p,
.section-heading p {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 12.5px;
}

.status-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
}

.status-facts > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 14px 18px;
  border-left: 1px solid var(--line);
}

.status-facts dt {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.status-facts dd {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 7px;
  margin: 4px 0 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 640;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fact-sub {
  color: var(--accent-strong);
  font-size: 11.5px;
  font-weight: 580;
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
  min-height: 76px;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 13px 18px;
  color: var(--text-muted);
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease;
}

.resource-stat + .resource-stat {
  border-left: 1px solid var(--line);
}

.resource-stat:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.resource-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text);
}

.resource-stat span:nth-child(2) {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.resource-stat small {
  color: var(--text-muted);
  font-size: 12px;
}

.resource-stat strong {
  color: var(--text-strong);
  font-size: 19px;
  font-weight: 660;
}

.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(300px, 0.85fr);
  gap: 14px;
}

.overview-main,
.overview-side {
  display: grid;
  align-content: start;
  gap: 14px;
  min-width: 0;
}

.section-panel {
  min-width: 0;
  overflow: hidden;
}

.section-heading {
  display: flex;
  min-height: 60px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--line);
}

.section-heading h2 {
  font-size: 15px;
}

.section-heading a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--info);
  font-size: 12.5px;
  font-weight: 580;
  text-decoration: none;
  white-space: nowrap;
}

.section-heading a:hover {
  text-decoration: underline;
}

.attention-list {
  display: grid;
}

.attention-row {
  display: grid;
  min-height: 50px;
  grid-template-columns: 112px minmax(110px, 0.45fr) minmax(170px, 1fr) 76px;
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
.session-row:hover,
.audit-mini-row:hover {
  background: var(--surface-hover);
}

.attention-name {
  overflow: hidden;
  color: var(--text-strong);
  font-weight: 610;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-message {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12.5px;
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
  grid-template-columns: 88px minmax(120px, 1.1fr) minmax(78px, 0.7fr) minmax(115px, 1fr) 74px 88px;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
}

.session-head {
  min-height: 36px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.session-row {
  min-height: 50px;
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
  font-weight: 600;
}

.audit-mini-list {
  display: grid;
}

.audit-mini-row {
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 18px;
  border-bottom: 1px solid var(--line);
  text-decoration: none;
}

.audit-mini-row:last-child {
  border-bottom: 0;
}

.audit-mini-main {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.audit-mini-main code {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-mini-main small,
.audit-mini-row time {
  color: var(--text-muted);
  font-size: 11.5px;
}

.quiet-state {
  display: flex;
  min-height: 84px;
  align-items: center;
  gap: 11px;
  justify-content: center;
  padding: 16px;
  color: var(--accent-strong);
}

.quiet-state.compact {
  min-height: 68px;
}

.quiet-state span {
  display: grid;
}

.quiet-state strong {
  color: var(--text-strong);
  font-weight: 610;
}

.quiet-state small {
  color: var(--text-muted);
}

.catalog-list {
  display: grid;
  margin: 0;
  padding: 4px 18px 10px;
}

.catalog-list > div,
.source-row {
  display: flex;
  min-height: 46px;
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
  font-weight: 610;
}

.source-list {
  padding: 0 18px 8px;
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

@media (max-width: 1220px) {
  .status-spine {
    grid-template-columns: 1fr;
  }

  .status-facts {
    border-top: 1px solid var(--line);
  }

  .status-facts > div:first-child {
    border-left: 0;
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
    padding: 15px 16px;
  }

  .status-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .status-facts > div {
    padding: 12px 14px;
  }

  .status-facts > div:nth-child(3) {
    border-left: 0;
  }

  .status-facts > div:nth-child(n + 3) {
    border-top: 1px solid var(--line);
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
