<script setup lang="ts">
import {
  Filter,
  ListChecks,
  RefreshCw,
  Search,
  ShieldOff,
  X,
} from '@lucide/vue'
import { computed, ref } from 'vue'

import { BaseButton, EmptyState, InlineNotice, StatusBadge } from '@/components/ui'
import type { AuditEvent } from '@/domain'
import { useI18n } from '@/i18n'
import { useAuditEventsQuery, useHopApiRuntime } from '@/queries'
import { formatRelativeTime, formatTimestamp } from '@/utils/format'

type TargetFilter = 'all' | 'asset' | 'credential' | 'access_key' | 'session' | 'known_host'

const auditQuery = useAuditEventsQuery()
const runtime = useHopApiRuntime()
const { t } = useI18n()

const search = ref('')
const category = ref<TargetFilter>('all')

const events = computed(() => auditQuery.data.value ?? [])
const loading = computed(() => runtime.ready.value && auditQuery.isPending.value)

const categoryItems = computed(() => [
  { id: 'all' as const, label: t('All events'), count: events.value.length },
  {
    id: 'asset' as const,
    label: t('Assets'),
    count: events.value.filter((item) => item.targetType === 'asset').length,
  },
  {
    id: 'credential' as const,
    label: t('Credentials'),
    count: events.value.filter((item) => item.targetType === 'credential').length,
  },
  {
    id: 'access_key' as const,
    label: t('Access'),
    count: events.value.filter((item) => item.targetType === 'access_key').length,
  },
  {
    id: 'session' as const,
    label: t('Sessions'),
    count: events.value.filter((item) => item.targetType === 'session').length,
  },
  {
    id: 'known_host' as const,
    label: t('Host trust'),
    count: events.value.filter((item) => item.targetType === 'known_host').length,
  },
])

const apiCount = computed(
  () => events.value.filter((event) => event.actorLabel === 'api-token').length,
)
const cliCount = computed(
  () => events.value.filter((event) => event.actorLabel === 'local-cli').length,
)

const filteredEvents = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return events.value.filter((event) => {
    const matchesCategory = category.value === 'all' || event.targetType === category.value
    if (!matchesCategory) return false
    if (!needle) return true
    return [
      event.action,
      event.actorLabel,
      event.targetType,
      event.targetLabel ?? '',
      event.targetId ?? '',
      event.detailsJson ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
})

function formatDetails(detailsJson: string | null): Array<{ key: string; value: string }> {
  if (!detailsJson) return []
  try {
    const parsed = JSON.parse(detailsJson) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .slice(0, 4)
      .map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      }))
  } catch {
    return []
  }
}

function actorTone(actor: string) {
  return actor === 'api-token' ? ('info' as const) : ('neutral' as const)
}

function resultTone(event: AuditEvent) {
  if (event.result === 'success' || event.result === 'ok') return 'success' as const
  if (event.result === 'noop') return 'warning' as const
  return 'danger' as const
}

function clearFilters() {
  search.value = ''
  category.value = 'all'
}
</script>

<template>
  <section class="audit-page page-stack" aria-labelledby="audit-title">
    <header class="page-intro">
      <div>
        <h1 id="audit-title">{{ t('Audit') }}</h1>
        <p>{{ t('Audit intro description') }}</p>
      </div>
      <div class="page-intro__actions">
        <BaseButton
          variant="secondary"
          :disabled="!runtime.ready.value || auditQuery.isFetching.value"
          @click="auditQuery.refetch()"
        >
          <template #leading>
            <RefreshCw :class="{ 'is-spinning': auditQuery.isFetching.value }" />
          </template>
          {{ t('Refresh') }}
        </BaseButton>
      </div>
    </header>

    <section class="audit-ledger panel" :aria-label="t('Audit summary')">
      <div class="audit-ledger__lead">
        <span class="audit-ledger__mark" aria-hidden="true">
          <ListChecks :size="20" />
        </span>
        <div>
          <strong>
            {{ !runtime.ready.value ? t('Reconnect required') : loading ? t('Loading audit events') : t('{count} recorded events', { count: events.length }) }}
          </strong>
          <small>{{ t('Retained automatically and pruned every 6 hours according to audit_retention_days.') }}</small>
        </div>
      </div>
      <dl class="tabular">
        <div>
          <dt>{{ t('Control API') }}</dt>
          <dd class="accent-value">{{ apiCount }}</dd>
        </div>
        <div>
          <dt>{{ t('Local CLI') }}</dt>
          <dd>{{ cliCount }}</dd>
        </div>
      </dl>
    </section>

    <section class="audit-panel panel">
      <header class="audit-toolbar">
        <div class="segmented-control audit-categories" role="group" :aria-label="t('Audit')">
          <button
            v-for="item in categoryItems"
            :key="item.id"
            type="button"
            :class="{ 'is-active': category === item.id }"
            :aria-pressed="category === item.id"
            @click="category = item.id"
          >
            {{ item.label }}
            <span class="count">{{ item.count }}</span>
          </button>
        </div>

        <label class="audit-search">
          <Search :size="16" aria-hidden="true" />
          <span class="sr-only">{{ t('Search audit events') }}</span>
          <input
            v-model="search"
            type="search"
            :placeholder="t('Search action, target, or actor')"
            autocomplete="off"
          />
          <button
            v-if="search"
            type="button"
            :aria-label="t('Clear search')"
            @click="search = ''"
          >
            <X :size="15" aria-hidden="true" />
          </button>
        </label>
      </header>

      <div
        v-if="loading"
        class="loading-rows"
        :aria-label="t('Loading audit events')"
        aria-busy="true"
      >
        <span v-for="index in 5" :key="index" />
      </div>

      <EmptyState
        v-else-if="!runtime.ready.value"
        :title="t('Reconnect required')"
        :description="t('Reauthentication explanation')"
        :icon="ShieldOff"
        compact
      />

      <InlineNotice
        v-else-if="auditQuery.isError.value"
        class="audit-error"
        tone="danger"
        :title="t('Audit events could not be loaded')"
      >
        {{ auditQuery.error.value instanceof Error ? auditQuery.error.value.message : t('Check the instance connection and try again.') }}
      </InlineNotice>

      <EmptyState
        v-else-if="events.length === 0"
        :title="t('No audit events recorded')"
        :description="t('Catalog mutations, probes, session terminations, and trust resets will appear here.')"
        :icon="ListChecks"
        compact
      />

      <EmptyState
        v-else-if="filteredEvents.length === 0"
        :title="t('No matching audit events')"
        :description="t('Try another filter or search term.')"
        :icon="Filter"
        compact
      >
        <template #actions>
          <BaseButton variant="secondary" @click="clearFilters">{{ t('Clear filters') }}</BaseButton>
        </template>
      </EmptyState>

      <div v-else class="audit-table" role="table" :aria-label="t('Audit')">
        <div class="audit-head" role="row">
          <span role="columnheader">{{ t('Time') }}</span>
          <span role="columnheader">{{ t('Action') }}</span>
          <span role="columnheader">{{ t('Target') }}</span>
          <span role="columnheader">{{ t('Actor') }}</span>
          <span role="columnheader">{{ t('Details') }}</span>
        </div>

        <div
          v-for="event in filteredEvents"
          :key="event.id"
          class="audit-row"
          role="row"
        >
          <span class="audit-time tabular" role="cell" :title="formatTimestamp(event.occurredAt)">
            <strong>{{ formatRelativeTime(event.occurredAt) }}</strong>
            <small>{{ formatTimestamp(event.occurredAt) }}</small>
          </span>
          <span class="audit-action" role="cell">
            <code class="mono">{{ event.action }}</code>
            <StatusBadge :label="event.result" :tone="resultTone(event)" />
          </span>
          <span class="audit-target" role="cell">
            <strong>{{ event.targetLabel || event.targetId || '—' }}</strong>
            <small class="mono">{{ event.targetType }}</small>
          </span>
          <span role="cell">
            <StatusBadge :label="event.actorLabel" :tone="actorTone(event.actorLabel)" />
          </span>
          <span class="audit-details" role="cell">
            <span
              v-for="detail in formatDetails(event.detailsJson)"
              :key="detail.key"
              class="tag-chip mono"
            >
              {{ detail.key }}={{ detail.value }}
            </span>
            <span v-if="formatDetails(event.detailsJson).length === 0" class="muted-dash">—</span>
          </span>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.audit-ledger {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(240px, 0.8fr);
  overflow: hidden;
}

.audit-ledger__lead {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
}

.audit-ledger__mark {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--line));
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.audit-ledger__lead > div {
  display: grid;
  gap: 2px;
}

.audit-ledger__lead strong {
  color: var(--text-strong);
  font-size: 15px;
  font-weight: 640;
}

.audit-ledger__lead small {
  color: var(--text-muted);
  font-size: 12.5px;
}

.audit-ledger dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
}

.audit-ledger dl > div {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 14px 20px;
  border-left: 1px solid var(--line);
}

.audit-ledger dt {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.audit-ledger dd {
  margin: 4px 0 0;
  color: var(--text-strong);
  font-size: 19px;
  font-weight: 650;
}

.audit-ledger .accent-value {
  color: var(--accent-strong);
}

.audit-panel {
  overflow: hidden;
}

.audit-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
}

.audit-categories {
  overflow-x: auto;
  max-width: 100%;
}

.audit-search {
  display: flex;
  min-width: 220px;
  flex: 1 1 240px;
  max-width: 340px;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  color: var(--text-muted);
}

.audit-search:focus-within {
  border-color: var(--focus);
}

.audit-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-strong);
  outline: 0;
}

.audit-search button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.audit-error {
  margin: 14px;
}

.audit-table {
  display: grid;
}

.audit-head,
.audit-row {
  display: grid;
  grid-template-columns: 140px minmax(190px, 1.1fr) minmax(130px, 0.9fr) 118px minmax(180px, 1.4fr);
  align-items: center;
  gap: 12px;
  padding: 0 16px;
}

.audit-head {
  min-height: 38px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.audit-row {
  min-height: 56px;
  padding-block: 8px;
  border-bottom: 1px solid var(--line);
}

.audit-row:last-child {
  border-bottom: 0;
}

.audit-row:hover {
  background: var(--surface-hover);
}

.audit-time,
.audit-target {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.audit-time strong,
.audit-target strong {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 590;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-time small,
.audit-target small {
  color: var(--text-muted);
  font-size: 11.5px;
}

.audit-action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.audit-action code {
  color: var(--text-strong);
  font-size: 12px;
}

.audit-details {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.muted-dash {
  color: var(--text-muted);
}

.loading-rows {
  display: grid;
}

.loading-rows span {
  height: 54px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-raised) 50%, transparent);
}

.is-spinning {
  animation: audit-spin 800ms linear infinite;
}

@keyframes audit-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1080px) {
  .audit-ledger {
    grid-template-columns: 1fr;
  }

  .audit-ledger dl {
    border-top: 1px solid var(--line);
  }

  .audit-ledger dl > div:first-child {
    border-left: 0;
  }

  .audit-head {
    display: none;
  }

  .audit-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 12px;
    padding: 12px 14px;
  }

  .audit-action {
    grid-column: 1;
    grid-row: 1;
  }

  .audit-time {
    grid-column: 2;
    grid-row: 1;
    text-align: right;
  }

  .audit-target {
    grid-column: 1;
    grid-row: 2;
  }

  .audit-row > :nth-child(4) {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
  }

  .audit-details {
    grid-column: 1 / -1;
    grid-row: 3;
  }
}

@media (max-width: 640px) {
  .audit-search {
    max-width: none;
  }
}
</style>
