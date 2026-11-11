<script setup lang="ts">
/* global navigator, setTimeout, clearTimeout */

import {
  Cable,
  Check,
  Copy,
  FileCode2,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  SquareTerminal,
} from '@lucide/vue'
import { computed, onBeforeUnmount, ref } from 'vue'

import { getPanelRuntimeConfig } from '@/api'
import { BaseButton, InlineNotice, StatusBadge } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useStatusQuery } from '@/queries'
import { useConnection } from '@/stores/connection'
import { inferDefaultHopHost, parseSshListenPort } from '@/utils/ssh-config'

const connection = useConnection()
const statusQuery = useStatusQuery()
const { t } = useI18n()
const panelRuntime = getPanelRuntimeConfig()
const isOpenWrt = panelRuntime.deployment === 'openwrt'

const copiedCli = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const connectionLabel = computed(() => {
  if (connection.state.mode === 'demo') return t('Demo workspace')
  if (connection.state.endpoint === '') return t('Same origin')
  return t('Remote instance')
})

const endpointLabel = computed(() => connection.state.endpoint || globalThis.location.origin)
const sshListenLabel = computed(
  () => statusQuery.data.value?.sshListen ?? connection.state.sshListen ?? '0.0.0.0:2222',
)

const cliSnippet = computed(() => {
  const host = inferDefaultHopHost(connection.state.endpoint, globalThis.location?.hostname)
  const port = parseSshListenPort(sshListenLabel.value)
  const portFlag = port === 2222 ? '' : ` --port ${port}`
  return `hop-server ssh-config --host ${host}${portFlag} >> ~/.ssh/config`
})

async function copyCli() {
  if (!navigator.clipboard) return
  await navigator.clipboard.writeText(cliSnippet.value)
  copiedCli.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copiedCli.value = false
  }, 1600)
}

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
})
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
          <span class="settings-icon" aria-hidden="true"><Cable :size="19" /></span>
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
          <div><dt>{{ t('SSH relay endpoint') }}</dt><dd class="mono">{{ sshListenLabel }}</dd></div>
          <div><dt>{{ t('Version') }}</dt><dd class="mono">{{ statusQuery.data.value?.version ?? connection.state.version ?? '—' }}</dd></div>
        </dl>
      </article>

      <article class="settings-panel panel">
        <header>
          <span class="settings-icon" aria-hidden="true"><KeyRound :size="19" /></span>
          <div>
            <h2>{{ t('Webpage management Token') }}</h2>
            <p>{{ t('One Bearer Token authorizes all panel actions for this Hop instance.') }}</p>
          </div>
          <StatusBadge
            :label="t(connection.state.mode === 'live' ? 'This tab' : 'Not stored')"
            :tone="connection.state.insecureToken ? 'warning' : 'neutral'"
          />
        </header>
        <p class="settings-copy">{{ t(isOpenWrt ? 'OpenWrt token storage explanation' : 'Token storage explanation') }}</p>
      </article>
    </section>

    <section class="cli-panel panel">
      <header class="cli-panel__head">
        <span class="settings-icon accent" aria-hidden="true"><SquareTerminal :size="19" /></span>
        <div>
          <h2>~/.ssh/config</h2>
          <p>{{ t('Generate local ~/.ssh/config from CLI or the Assets toolbar.') }}</p>
        </div>
      </header>
      <div class="code-snippet">
        <code :title="cliSnippet">{{ cliSnippet }}</code>
        <BaseButton size="sm" variant="secondary" @click="void copyCli()">
          <template #leading>
            <Check v-if="copiedCli" />
            <Copy v-else />
          </template>
          {{ t(copiedCli ? 'Copied' : 'Copy CLI command') }}
        </BaseButton>
      </div>
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
      <LockKeyhole :size="20" aria-hidden="true" />
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
.cli-panel {
  min-width: 0;
  padding: 18px;
}

.cli-panel {
  display: grid;
  gap: 12px;
}

.settings-panel > header,
.ownership-panel > header,
.cli-panel__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.settings-panel > header > div,
.ownership-panel > header > div,
.cli-panel__head > div,
.ownership-row > div,
.security-note > div {
  min-width: 0;
  flex: 1;
}

.settings-panel h2,
.ownership-panel h2,
.cli-panel h2,
.security-note h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 15.5px;
  font-weight: 640;
}

.settings-panel header p,
.ownership-panel header p,
.cli-panel p,
.security-note p,
.ownership-row p,
.settings-copy {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.settings-icon,
.ownership-mark {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--info-soft);
  color: var(--info);
}

.settings-icon.accent,
.ownership-mark.local {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--line));
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.settings-panel dl {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
}

.settings-panel dl div {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
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
  padding: 15px 18px;
}

.ownership-row + .ownership-row {
  border-top: 1px solid var(--line);
}

.ownership-row strong {
  color: var(--text-strong);
}

.security-note {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 16px 18px;
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
