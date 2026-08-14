<script setup lang="ts">
import {
  Activity,
  ArrowLeft,
  CircleCheck,
  Clock3,
  MonitorUp,
  RefreshCw,
  Server,
  SquareTerminal,
  Unplug,
  X,
} from '@lucide/vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { BaseButton, ConfirmDialog, EmptyState, InlineNotice, StatusBadge } from '@/components/ui'
import type { Session } from '@/domain'
import { useSessionsQuery, useTerminateSessionMutation } from '@/queries'
import { formatDuration, formatRelativeTime, formatTimestamp, shortFingerprint } from '@/utils/format'

type SessionView = 'active' | 'recent'
type Notice = { tone: 'success' | 'warning' | 'danger'; title: string; message: string }

const route = useRoute()
const router = useRouter()
const sessionsQuery = useSessionsQuery()
const terminateMutation = useTerminateSessionMutation()

const view = ref<SessionView>('recent')
const terminateOpen = ref(false)
const notice = ref<Notice | null>(null)

const sessions = computed(() => sessionsQuery.data.value ?? [])
const activeSessions = computed(() => sessions.value.filter((session) => session.status === 'started'))
const visibleSessions = computed(() =>
  view.value === 'active' ? activeSessions.value : sessions.value,
)
const selectedId = computed(() =>
  typeof route.query.session === 'string' ? route.query.session : null,
)
const selectedSession = computed(
  () => sessions.value.find((session) => session.id === selectedId.value) ?? null,
)
const queryError = computed(() => errorMessage(sessionsQuery.error.value))

function setSelection(id: string | null) {
  const query = { ...route.query }
  if (id === null) delete query.session
  else query.session = id
  notice.value = null
  void router.replace({ query })
}

function selectView(next: SessionView) {
  view.value = next
  if (
    next === 'active' &&
    selectedSession.value !== null &&
    selectedSession.value.status !== 'started'
  ) {
    setSelection(null)
  }
}

function statusLabel(status: string) {
  if (status === 'started') return 'Active'
  if (status === 'ok') return 'Completed'
  if (status === 'terminated') return 'Terminated'
  if (status === 'failed') return 'Failed'
  return status
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'started' || status === 'ok') return 'success'
  if (status === 'terminated') return 'warning'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function modeLabel(mode: string) {
  const labels: Record<string, string> = {
    direct: 'Direct SSH',
    exec: 'Remote command',
    sftp: 'SFTP',
    tui: 'TUI',
    'tui-connect': 'TUI connect',
    'tcp-forward': 'TCP forward',
  }
  return labels[mode] ?? mode
}

function targetLabel(session: Session) {
  return session.assetName ?? session.targetHost ?? 'Unknown target'
}

function targetAddress(session: Session) {
  if (session.targetHost === null) return 'Not recorded'
  return session.targetPort === null
    ? session.targetHost
    : `${session.targetHost}:${session.targetPort}`
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return error ? String(error) : ''
}

async function confirmTerminate() {
  const session = selectedSession.value
  if (session === null || session.status !== 'started') return

  notice.value = null
  try {
    const result = await terminateMutation.mutateAsync(session.id)
    terminateOpen.value = false
    notice.value = result.terminated
      ? {
          tone: 'success',
          title: 'Termination signal sent',
          message: `${targetLabel(session)} was marked terminated and its active transport was signalled.`,
        }
      : {
          tone: 'warning',
          title: 'Session is no longer active',
          message:
            'Hop kept the recent session record, but no active transport was registered. It may have ended before this request arrived.',
        }
  } catch (error) {
    terminateOpen.value = false
    notice.value = {
      tone: 'danger',
      title: 'Session could not be terminated',
      message: errorMessage(error) || 'Check the instance connection and try again.',
    }
  }
}
</script>

<template>
  <section class="sessions-page page-stack" aria-labelledby="sessions-title">
    <header class="page-intro sessions-intro">
      <div>
        <h1 id="sessions-title">Sessions</h1>
        <p>Recent connection records and explicit control for sessions still marked active.</p>
      </div>
      <button
        class="icon-button"
        type="button"
        :disabled="sessionsQuery.isFetching.value"
        aria-label="Refresh sessions"
        title="Refresh sessions"
        @click="sessionsQuery.refetch()"
      >
        <RefreshCw
          :size="18"
          :class="{ 'is-spinning': sessionsQuery.isFetching.value }"
          aria-hidden="true"
        />
      </button>
    </header>

    <InlineNotice
      v-if="sessionsQuery.isError.value && sessions.length > 0"
      tone="warning"
      title="Showing the last session response"
    >
      {{ queryError }}
      <template #actions>
        <BaseButton variant="secondary" @click="sessionsQuery.refetch()">Retry</BaseButton>
      </template>
    </InlineNotice>

    <InlineNotice
      v-if="notice"
      :tone="notice.tone"
      :title="notice.title"
    >
      {{ notice.message }}
    </InlineNotice>

    <section class="session-ledger panel" aria-label="Session summary">
      <div class="ledger-lead">
        <span class="ledger-mark" aria-hidden="true"><MonitorUp :size="21" /></span>
        <div>
          <strong>{{ sessionsQuery.isPending.value ? 'Reading session ledger…' : `${sessions.length} recent records` }}</strong>
          <small>The Control API returns at most the latest 100 sessions.</small>
        </div>
      </div>
      <dl>
        <div>
          <dt>Started status</dt>
          <dd class="tabular accent-value">{{ activeSessions.length }}</dd>
        </div>
        <div>
          <dt>Finished records</dt>
          <dd class="tabular">{{ sessions.length - activeSessions.length }}</dd>
        </div>
      </dl>
    </section>

    <section
      class="sessions-workspace"
      :class="{ 'has-selection': selectedSession !== null }"
    >
      <div class="session-list panel">
        <header class="session-toolbar">
          <div class="view-switch" aria-label="Session list view">
            <button
              type="button"
              :class="{ active: view === 'recent' }"
              :aria-pressed="view === 'recent'"
              @click="selectView('recent')"
            >
              Recent <span class="tabular">{{ sessions.length }}</span>
            </button>
            <button
              type="button"
              :class="{ active: view === 'active' }"
              :aria-pressed="view === 'active'"
              @click="selectView('active')"
            >
              Active <span class="tabular">{{ activeSessions.length }}</span>
            </button>
          </div>
          <span class="toolbar-note">Status is recorded by Hop, not inferred by the panel.</span>
        </header>

        <div
          v-if="sessionsQuery.isPending.value"
          class="loading-rows"
          aria-label="Loading sessions"
          aria-busy="true"
        >
          <span v-for="index in 5" :key="index" />
        </div>

        <InlineNotice
          v-else-if="sessionsQuery.isError.value && sessions.length === 0"
          class="query-error"
          tone="danger"
          title="Sessions could not be loaded"
        >
          {{ queryError || 'Check the instance connection and try again.' }}
          <template #actions>
            <BaseButton variant="secondary" @click="sessionsQuery.refetch()">Retry</BaseButton>
          </template>
        </InlineNotice>

        <EmptyState
          v-else-if="sessions.length === 0"
          title="No session records"
          description="Connections will appear here after an Access Key reaches Hop."
          :icon="Clock3"
          compact
        />

        <EmptyState
          v-else-if="visibleSessions.length === 0"
          title="No active session records"
          description="The recent ledger contains only completed, failed, or terminated sessions."
          :icon="CircleCheck"
          compact
        >
          <template #actions>
            <BaseButton variant="secondary" @click="selectView('recent')">Show recent</BaseButton>
          </template>
        </EmptyState>

        <div v-else class="session-table" role="table" aria-label="Recent Hop sessions">
          <div class="session-head" role="row">
            <span role="columnheader">Started</span>
            <span role="columnheader">Target</span>
            <span role="columnheader">Access Key</span>
            <span role="columnheader">Mode</span>
            <span role="columnheader">Duration</span>
            <span role="columnheader">Status</span>
          </div>
          <button
            v-for="session in visibleSessions"
            :key="session.id"
            class="session-row"
            :class="{ selected: session.id === selectedId }"
            type="button"
            role="row"
            :aria-current="session.id === selectedId ? 'true' : undefined"
            @click="setSelection(session.id)"
          >
            <span class="row-time tabular" role="cell">
              <strong>{{ formatRelativeTime(session.startedAt) }}</strong>
              <small>{{ formatTimestamp(session.startedAt) }}</small>
            </span>
            <span class="row-target" role="cell">
              <span class="target-mark" aria-hidden="true">
                <Server v-if="session.mode !== 'tcp-forward'" :size="16" />
                <Activity v-else :size="16" />
              </span>
              <span>
                <strong>{{ targetLabel(session) }}</strong>
                <small class="mono">{{ targetAddress(session) }}</small>
              </span>
            </span>
            <span class="row-key" role="cell">
              <strong>{{ session.keyName ?? 'Unnamed key' }}</strong>
              <small class="mono">{{ shortFingerprint(session.keyFingerprint) }}</small>
            </span>
            <span role="cell">{{ modeLabel(session.mode) }}</span>
            <span class="tabular" role="cell">{{ formatDuration(session.startedAt, session.endedAt) }}</span>
            <span role="cell">
              <StatusBadge :label="statusLabel(session.status)" :tone="statusTone(session.status)" />
            </span>
          </button>
        </div>

        <footer class="session-list-footer">
          <span>{{ visibleSessions.length }} shown</span>
          <span v-if="view === 'active'">Only records with <code>started</code> status</span>
        </footer>
      </div>

      <aside class="session-detail panel" aria-label="Session details">
        <template v-if="selectedSession">
          <header class="detail-heading">
            <button
              class="mobile-back"
              type="button"
              aria-label="Back to sessions"
              @click="setSelection(null)"
            >
              <ArrowLeft :size="19" aria-hidden="true" />
            </button>
            <span class="detail-mark" aria-hidden="true"><SquareTerminal :size="20" /></span>
            <div>
              <h2>{{ targetLabel(selectedSession) }}</h2>
              <p>{{ modeLabel(selectedSession.mode) }}</p>
            </div>
            <button
              class="detail-close"
              type="button"
              aria-label="Close session details"
              @click="setSelection(null)"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </header>

          <div class="detail-status">
            <StatusBadge
              :label="statusLabel(selectedSession.status)"
              :tone="statusTone(selectedSession.status)"
            />
            <span class="tabular">{{ formatDuration(selectedSession.startedAt, selectedSession.endedAt) }}</span>
          </div>

          <dl class="detail-facts">
            <div>
              <dt>Started</dt>
              <dd>{{ formatTimestamp(selectedSession.startedAt) }}</dd>
            </div>
            <div>
              <dt>Ended</dt>
              <dd>{{ selectedSession.endedAt ? formatTimestamp(selectedSession.endedAt) : 'Still open' }}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd class="mono">{{ targetAddress(selectedSession) }}</dd>
            </div>
            <div>
              <dt>Client IP</dt>
              <dd class="mono">{{ selectedSession.clientIp ?? 'Not recorded' }}</dd>
            </div>
            <div>
              <dt>Access Key</dt>
              <dd>{{ selectedSession.keyName ?? 'Unnamed key' }}</dd>
            </div>
            <div>
              <dt>Fingerprint</dt>
              <dd class="mono wrap-value">{{ selectedSession.keyFingerprint }}</dd>
            </div>
            <div class="wide-fact">
              <dt>Session ID</dt>
              <dd class="mono wrap-value">{{ selectedSession.id }}</dd>
            </div>
          </dl>

          <InlineNotice
            v-if="selectedSession.error"
            :tone="selectedSession.status === 'failed' ? 'danger' : 'warning'"
            title="Recorded session error"
          >
            {{ selectedSession.error }}
          </InlineNotice>

          <InlineNotice
            v-else-if="selectedSession.status === 'started'"
            tone="info"
            title="Started is a Catalog status"
          >
            Hop will attempt to signal the active in-memory transport. A stale record can return “not active”.
          </InlineNotice>

          <footer class="detail-actions">
            <BaseButton
              variant="danger"
              :disabled="selectedSession.status !== 'started'"
              @click="terminateOpen = true"
            >
              <template #leading><Unplug /></template>
              Terminate session
            </BaseButton>
            <p v-if="selectedSession.status !== 'started'">Only sessions with started status can be terminated.</p>
          </footer>
        </template>

        <EmptyState
          v-else
          title="Select a session"
          description="Choose a row to inspect its target, Access Key, duration, and recorded outcome."
          :icon="MonitorUp"
          compact
        />
      </aside>
    </section>

    <ConfirmDialog
      v-model:open="terminateOpen"
      title="Terminate this session?"
      :description="selectedSession
        ? `Hop will signal the active transport for ${targetLabel(selectedSession)}. The recent session record will remain available.`
        : 'Hop will signal the active transport.'"
      confirm-label="Terminate session"
      :busy="terminateMutation.isPending.value"
      @confirm="confirmTerminate"
    />
  </section>
</template>

<style scoped>
.sessions-page {
  gap: 12px;
}

.sessions-intro {
  align-items: center;
}

.icon-button,
.detail-close,
.mobile-back {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: var(--radius-control);
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}

.icon-button {
  border: 1px solid var(--line);
  background: var(--surface-raised);
}

.icon-button:hover:not(:disabled),
.detail-close:hover,
.mobile-back:hover {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.is-spinning {
  animation: sessions-spin 800ms linear infinite;
}

.session-ledger {
  display: grid;
  min-height: 82px;
  grid-template-columns: minmax(280px, 1fr) minmax(310px, 0.7fr);
  overflow: hidden;
}

.ledger-lead {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px 18px;
}

.ledger-mark,
.detail-mark,
.target-mark {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: var(--accent);
  background: var(--accent-soft);
}

.ledger-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.ledger-lead div,
.row-time,
.row-target > span:last-child,
.row-key {
  display: grid;
  min-width: 0;
}

.ledger-lead strong {
  color: var(--text-strong);
  font-size: 0.9375rem;
}

.ledger-lead small,
.session-row small,
.toolbar-note {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.session-ledger dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
}

.session-ledger dl > div {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 14px 18px;
  border-left: 1px solid var(--line);
}

.session-ledger dt {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.session-ledger dd {
  margin: 2px 0 0;
  color: var(--text-strong);
  font-size: 1.125rem;
  font-weight: 650;
}

.session-ledger .accent-value {
  color: var(--accent);
}

.sessions-workspace {
  display: grid;
  min-height: 570px;
  grid-template-columns: minmax(0, 1fr) minmax(310px, 0.42fr);
  gap: 12px;
}

.session-list,
.session-detail {
  min-width: 0;
  overflow: hidden;
}

.session-list {
  display: grid;
  align-content: start;
  grid-template-rows: auto auto 1fr auto;
}

.session-toolbar {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
}

.view-switch {
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-input);
}

.view-switch button {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  border-radius: 7px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}

.view-switch button:hover,
.view-switch button.active {
  color: var(--text-strong);
  background: var(--surface-raised);
}

.view-switch button span {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.toolbar-note {
  text-align: right;
}

.session-table {
  min-width: 0;
}

.session-head,
.session-row {
  display: grid;
  grid-template-columns: minmax(112px, 0.65fr) minmax(164px, 1.2fr) minmax(135px, 0.95fr) minmax(104px, 0.7fr) 76px 92px;
  align-items: center;
  gap: 10px;
  padding: 0 13px;
}

.session-head {
  min-height: 38px;
  border-bottom: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 0.6875rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.session-row {
  width: 100%;
  min-height: 62px;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.session-row:hover {
  background: var(--surface-hover);
}

.session-row.selected {
  background: var(--surface-selected);
}

.session-row:focus-visible {
  position: relative;
  z-index: 1;
  outline-offset: -2px;
}

.session-row strong,
.session-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-row strong {
  color: var(--text-strong);
  font-size: 0.8125rem;
  font-weight: 620;
}

.row-target {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.target-mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.session-list-footer {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 13px;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.session-list-footer code {
  color: var(--text);
  font-family: var(--font-mono);
}

.query-error {
  margin: 12px;
}

.loading-rows {
  display: grid;
}

.loading-rows span {
  min-height: 62px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(90deg, transparent, var(--surface-hover), transparent);
  background-size: 220% 100%;
  animation: loading-sweep 1.4s ease-in-out infinite;
}

.session-detail {
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--surface-panel) 82%, var(--surface-canvas));
}

.detail-heading {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  min-height: 72px;
  padding: 12px 12px 12px 16px;
  border-bottom: 1px solid var(--line);
}

.detail-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.detail-heading h2,
.detail-heading p {
  margin: 0;
}

.detail-heading h2 {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 1rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-heading p {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.mobile-back {
  display: none;
}

.detail-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
}

.detail-status > span:last-child {
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.detail-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 8px 16px 16px;
}

.detail-facts > div {
  min-width: 0;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.detail-facts > div:nth-child(odd):not(.wide-fact) {
  padding-right: 12px;
}

.detail-facts > div:nth-child(even) {
  padding-left: 12px;
  border-left: 1px solid var(--line);
}

.detail-facts .wide-fact {
  grid-column: 1 / -1;
}

.detail-facts dt {
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.detail-facts dd {
  margin: 3px 0 0;
  color: var(--text-strong);
  font-size: 0.8125rem;
}

.wrap-value {
  overflow-wrap: anywhere;
}

.session-detail :deep(.inline-notice) {
  margin: 0 16px 16px;
}

.detail-actions {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding: 16px;
  border-top: 1px solid var(--line);
}

.detail-actions :deep(.base-button) {
  width: 100%;
}

.detail-actions p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-align: center;
}

@keyframes sessions-spin {
  to { transform: rotate(360deg); }
}

@keyframes loading-sweep {
  to { background-position: -220% 0; }
}

@media (max-width: 1279px) {
  .sessions-workspace {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 0.52fr);
  }

  .session-head,
  .session-row {
    grid-template-columns: 108px minmax(150px, 1fr) minmax(118px, 0.8fr) 82px 88px;
  }

  .session-head > :nth-child(5),
  .session-row > :nth-child(5) {
    display: none;
  }
}

@media (max-width: 1040px) {
  .session-head,
  .session-row {
    grid-template-columns: 104px minmax(150px, 1fr) minmax(110px, 0.7fr) 88px;
  }

  .session-head > :nth-child(4),
  .session-row > :nth-child(4) {
    display: none;
  }

  .toolbar-note {
    display: none;
  }
}

@media (max-width: 899px) {
  .sessions-intro > div p {
    max-width: 54ch;
  }

  .session-ledger {
    grid-template-columns: 1fr;
  }

  .session-ledger dl {
    border-top: 1px solid var(--line);
  }

  .session-ledger dl > div:first-child {
    border-left: 0;
  }

  .sessions-workspace {
    display: block;
    min-height: 0;
  }

  .session-detail {
    display: none;
  }

  .sessions-workspace.has-selection .session-detail {
    position: fixed;
    inset: 0 0 68px;
    z-index: 45;
    display: flex;
    overflow-y: auto;
    border: 0;
    border-radius: 0;
    background: var(--surface-canvas);
  }

  .sessions-workspace.has-selection .detail-heading {
    position: sticky;
    top: 0;
    z-index: 2;
    grid-template-columns: auto auto minmax(0, 1fr);
    background: var(--surface-panel);
  }

  .sessions-workspace.has-selection .mobile-back {
    display: grid;
  }

  .sessions-workspace.has-selection .detail-close {
    display: none;
  }

  .detail-actions {
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
  }
}

@media (max-width: 620px) {
  .sessions-intro p {
    display: none;
  }

  .session-ledger {
    display: none;
  }

  .session-toolbar {
    min-height: 58px;
  }

  .view-switch,
  .view-switch button {
    flex: 1;
  }

  .view-switch {
    width: 100%;
  }

  .view-switch button {
    justify-content: center;
  }

  .session-head {
    display: none;
  }

  .session-row {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 76px;
    gap: 10px;
    padding: 10px 12px;
  }

  .session-row > :not(.row-target):not(:last-child) {
    display: none;
  }

  .session-list-footer {
    padding-bottom: 12px;
  }

  .session-list-footer span:last-child {
    display: none;
  }

  .detail-facts {
    grid-template-columns: 1fr;
  }

  .detail-facts > div,
  .detail-facts > div:nth-child(odd):not(.wide-fact),
  .detail-facts > div:nth-child(even) {
    grid-column: auto;
    padding: 12px 0;
    border-left: 0;
  }
}
</style>
