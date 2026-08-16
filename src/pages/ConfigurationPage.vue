<script setup lang="ts">
import { Cable, FileCode2, KeyRound, LockKeyhole, ShieldCheck } from '@lucide/vue'
import { computed } from 'vue'

import { InlineNotice, StatusBadge } from '@/components/ui'
import { getPanelRuntimeConfig } from '@/api'
import { useI18n } from '@/i18n'
import { useStatusQuery } from '@/queries'
import { useConnection } from '@/stores/connection'

const connection = useConnection()
const statusQuery = useStatusQuery()
const { t } = useI18n()
const panelRuntime = getPanelRuntimeConfig()
const isOpenWrt = panelRuntime.deployment === 'openwrt'

const connectionLabel = computed(() => {
  if (connection.state.mode === 'demo') return t('Demo workspace')
  if (connection.state.endpoint === '') return t('Same origin')
  return t('Remote instance')
})

const endpointLabel = computed(() => connection.state.endpoint || globalThis.location.origin)
</script>

<template>
  <div class="settings-page page-stack">
    <header class="page-intro">
      <div>
        <h1>{{ t('Settings') }}</h1>
        <p>{{ t('Settings connection description') }}</p>
      </div>
    </header>

    <InlineNotice
      v-if="connection.state.insecureToken"
      tone="warning"
      :title="t('Replace the placeholder Token')"
    >
      {{ t(isOpenWrt ? 'OpenWrt placeholder token settings warning' : 'Placeholder token settings warning') }}
    </InlineNotice>

    <section class="settings-grid">
      <article class="settings-panel panel">
        <header>
          <span class="settings-icon" aria-hidden="true"><Cable :size="20" /></span>
          <div>
            <h2>{{ t('Panel connection') }}</h2>
            <p>{{ t(isOpenWrt ? 'OpenWrt uses the LuCI-authenticated loopback proxy by default.' : 'Compose uses the panel Origin by default. A remote URL is an advanced option.') }}</p>
          </div>
          <StatusBadge
            :label="t(connection.state.mode === 'live' ? 'Connected' : connection.state.mode === 'demo' ? 'Demo workspace' : 'Token required status')"
            :tone="connection.state.mode === 'live' ? 'success' : connection.state.mode === 'demo' ? 'info' : 'warning'"
          />
        </header>
        <dl>
          <div><dt>{{ t('Mode') }}</dt><dd>{{ connectionLabel }}</dd></div>
          <div><dt>{{ t('Endpoint') }}</dt><dd class="mono wrap-value">{{ endpointLabel }}</dd></div>
          <div><dt>{{ t('Version') }}</dt><dd>{{ statusQuery.data.value?.version ?? connection.state.version ?? '—' }}</dd></div>
        </dl>
      </article>

      <article class="settings-panel panel">
        <header>
          <span class="settings-icon" aria-hidden="true"><KeyRound :size="20" /></span>
          <div>
            <h2>{{ t('Webpage management Token') }}</h2>
            <p>{{ t('One Bearer Token authorizes all panel actions for this Hop instance.') }}</p>
          </div>
          <StatusBadge
            :label="t(connection.state.mode === 'live' ? 'In memory' : 'Not stored')"
            :tone="connection.state.insecureToken ? 'warning' : 'neutral'"
          />
        </header>
        <p class="settings-copy">{{ t(isOpenWrt ? 'OpenWrt token storage explanation' : 'Token storage explanation') }}</p>
      </article>
    </section>

    <section class="ownership-panel panel" aria-labelledby="ownership-heading">
      <header>
        <div>
          <h2 id="ownership-heading">{{ t('Resource ownership') }}</h2>
          <p>{{ t('Ownership explanation') }}</p>
        </div>
      </header>
      <div class="ownership-row">
        <span class="ownership-mark local" aria-hidden="true"><ShieldCheck :size="19" /></span>
        <div><strong>{{ t('Panel / local') }}</strong><p>{{ t('Panel local explanation') }}</p></div>
        <StatusBadge :label="t('Editable')" tone="success" />
      </div>
      <div class="ownership-row">
        <span class="ownership-mark config" aria-hidden="true"><FileCode2 :size="19" /></span>
        <div><strong>{{ t('Configuration file') }}</strong><p>{{ t(isOpenWrt ? 'OpenWrt config ownership explanation' : 'Config ownership explanation') }}</p></div>
        <StatusBadge :label="t('Read-only')" tone="info" />
      </div>
    </section>

    <section class="security-note panel">
      <LockKeyhole :size="21" aria-hidden="true" />
      <div>
        <h2>{{ t('Browser security') }}</h2>
        <p>{{ t(isOpenWrt ? 'OpenWrt browser security explanation' : 'Browser security explanation') }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 1080px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.settings-panel,
.ownership-panel,
.security-note {
  border: 1px solid var(--line);
}

.settings-panel {
  min-width: 0;
  padding: 18px;
}

.settings-panel > header,
.ownership-panel > header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.settings-panel > header > div,
.ownership-panel > header > div,
.ownership-row > div,
.security-note > div {
  min-width: 0;
  flex: 1;
}

.settings-panel h2,
.ownership-panel h2,
.security-note h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
}

.settings-panel header p,
.ownership-panel header p,
.security-note p,
.ownership-row p,
.settings-copy {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.settings-icon,
.ownership-mark {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--radius-control);
  background: var(--info-soft);
  color: var(--info);
}

.settings-panel dl {
  display: grid;
  gap: 9px;
  margin: 18px 0 0;
}

.settings-panel dl div {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 12px;
}

.settings-panel dt {
  color: var(--text-muted);
}

.settings-panel dd {
  min-width: 0;
  margin: 0;
  color: var(--text-strong);
}

.wrap-value {
  overflow-wrap: anywhere;
}

.ownership-panel {
  overflow: hidden;
}

.ownership-panel > header {
  padding: 18px;
  border-bottom: 1px solid var(--line);
}

.ownership-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
}

.ownership-row + .ownership-row {
  border-top: 1px solid var(--line);
}

.ownership-row strong {
  color: var(--text-strong);
}

.ownership-mark.local {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.security-note {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 17px 18px;
  color: var(--info);
}

@media (max-width: 760px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .ownership-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
