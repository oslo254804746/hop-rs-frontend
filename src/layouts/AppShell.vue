<script setup lang="ts">
/* global HTMLDialogElement */

import {
  Cable,
  ChevronRight,
  CircleGauge,
  FlaskConical,
  KeyRound,
  Layers3,
  Menu,
  MonitorUp,
  Moon,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Sun,
  X,
} from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useConnection } from '@/stores/connection'
import { useTheme } from '@/stores/theme'

const route = useRoute()
const queryClient = useQueryClient()
const connection = useConnection()
const theme = useTheme()

const navItems = [
  { name: 'overview', label: 'Overview', to: '/', icon: CircleGauge },
  { name: 'assets', label: 'Assets', to: '/assets', icon: Server },
  { name: 'credentials', label: 'Credentials', to: '/credentials', icon: KeyRound },
  { name: 'access', label: 'Access', to: '/access', icon: ShieldCheck },
  { name: 'sessions', label: 'Sessions', to: '/sessions', icon: MonitorUp },
  { name: 'configuration', label: 'Configuration', to: '/configuration', icon: Settings2 },
] as const

const mobileItems = navItems.filter((item) =>
  ['overview', 'assets', 'access', 'sessions'].includes(item.name),
)

const pageTitle = computed(() => String(route.meta.title ?? 'Hop'))
const connectionDialog = ref<HTMLDialogElement | null>(null)
const mobileMenuOpen = ref(false)
const endpoint = ref(connection.state.endpoint || 'http://127.0.0.1:8083')
const token = ref('')
const submitError = ref('')

function openConnection() {
  submitError.value = ''
  endpoint.value = connection.state.endpoint || endpoint.value
  token.value = ''
  connectionDialog.value?.showModal()
}

function closeConnection() {
  connectionDialog.value?.close()
}

async function submitConnection() {
  submitError.value = ''
  try {
    await connection.connectToHop(endpoint.value, token.value)
    queryClient.clear()
    closeConnection()
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'The instance could not be reached.'
  }
}

function switchToDemo() {
  connection.useDemo()
  queryClient.clear()
  closeConnection()
}

function refresh() {
  void queryClient.invalidateQueries()
}
</script>

<template>
  <div class="app-frame">
    <aside class="sidebar" aria-label="Primary navigation">
      <RouterLink class="brand" to="/" aria-label="Hop overview">
        <span class="brand-mark" aria-hidden="true"><Layers3 :size="19" /></span>
        <span class="brand-word">Hop</span>
      </RouterLink>

      <nav class="primary-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="nav-link"
          :aria-label="item.label"
        >
          <component :is="item.icon" :size="19" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <button
        class="connection-card"
        type="button"
        :aria-label="`Open instance connection · ${connection.state.mode === 'live' ? 'Connected' : connection.state.mode === 'reauth' ? 'Authentication required' : 'Demo data · Synthetic workspace'}`"
        @click="openConnection"
      >
        <span class="connection-line">
          <span
            class="connection-dot"
            :class="`is-${connection.state.mode}`"
            aria-hidden="true"
          />
          <strong>
            {{
              connection.state.mode === 'live'
                ? 'Connected'
                : connection.state.mode === 'reauth'
                  ? 'Authenticate'
                  : 'Demo data'
            }}
          </strong>
        </span>
        <span class="connection-detail">
          {{ connection.state.mode === 'demo' ? 'Synthetic workspace' : connection.state.endpoint }}
        </span>
        <span class="connection-version tabular">
          {{ connection.state.version ?? (connection.state.mode === 'reauth' ? 'Token required' : 'v0.2 preview') }}
        </span>
        <ChevronRight class="connection-arrow" :size="17" aria-hidden="true" />
      </button>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div class="topbar-title">
          <span class="mobile-brand" aria-hidden="true">Hop</span>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="topbar-actions">
          <span class="mode-badge" :class="`is-${connection.state.mode}`">
            <FlaskConical v-if="connection.state.mode === 'demo'" :size="15" aria-hidden="true" />
            <Cable v-else :size="15" aria-hidden="true" />
            {{ connection.state.mode === 'demo' ? 'Demo workspace' : connection.state.mode === 'live' ? 'Connected' : 'Re-auth' }}
          </span>
          <button class="icon-action labeled-action" type="button" aria-label="Refresh data" @click="refresh">
            <RefreshCw :size="18" aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button
            class="icon-action labeled-action"
            type="button"
            :aria-label="`Use ${theme.resolvedTheme.value === 'dark' ? 'light' : 'dark'} theme`"
            @click="theme.toggleTheme"
          >
            <Sun v-if="theme.resolvedTheme.value === 'dark'" :size="18" aria-hidden="true" />
            <Moon v-else :size="18" aria-hidden="true" />
            <span>{{ theme.resolvedTheme.value === 'dark' ? 'Light' : 'Dark' }}</span>
          </button>
          <button class="configure-action" type="button" @click="openConnection">
            <Settings2 :size="17" aria-hidden="true" />
            Instance
          </button>
        </div>
      </header>

      <main id="main-content" class="main-content">
        <slot />
      </main>
    </section>

    <nav class="mobile-dock" aria-label="Mobile navigation">
      <RouterLink v-for="item in mobileItems" :key="item.name" :to="item.to" class="dock-link">
        <component :is="item.icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </RouterLink>
      <button class="dock-link" type="button" @click="mobileMenuOpen = true">
        <Menu :size="20" aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>

    <div v-if="mobileMenuOpen" class="mobile-sheet-layer" @click.self="mobileMenuOpen = false">
      <section class="mobile-sheet" aria-label="More navigation">
        <header>
          <strong>More</strong>
          <button class="icon-action" type="button" aria-label="Close menu" @click="mobileMenuOpen = false">
            <X :size="19" aria-hidden="true" />
          </button>
        </header>
        <RouterLink class="sheet-link" to="/credentials" @click="mobileMenuOpen = false">
          <KeyRound :size="19" aria-hidden="true" /> Credentials
        </RouterLink>
        <RouterLink class="sheet-link" to="/configuration" @click="mobileMenuOpen = false">
          <Settings2 :size="19" aria-hidden="true" /> Configuration
        </RouterLink>
        <button class="sheet-link" type="button" @click="mobileMenuOpen = false; openConnection()">
          <Cable :size="19" aria-hidden="true" /> Instance connection
        </button>
      </section>
    </div>

    <dialog ref="connectionDialog" class="connection-dialog" @click.self="closeConnection">
      <form class="connection-form" @submit.prevent="submitConnection">
        <header>
          <div>
            <h2>Connect an instance</h2>
            <p>Use one Hop Control API endpoint and its Bearer management token.</p>
          </div>
          <button class="icon-action" type="button" aria-label="Close connection settings" @click="closeConnection">
            <X :size="19" aria-hidden="true" />
          </button>
        </header>

        <label class="field">
          <span>Control API URL</span>
          <input v-model="endpoint" type="url" inputmode="url" autocomplete="url" required />
          <small>Usually `http://127.0.0.1:8083` through a trusted local proxy.</small>
        </label>

        <label class="field">
          <span>Bearer token</span>
          <input v-model="token" type="password" autocomplete="off" spellcheck="false" required />
          <small>The token stays in memory and is lost when this page reloads.</small>
        </label>

        <p v-if="submitError || connection.state.error" class="form-error" role="alert">
          {{ submitError || connection.state.error }}
        </p>

        <div class="connection-actions">
          <button class="button-secondary" type="button" @click="switchToDemo">
            <FlaskConical :size="17" aria-hidden="true" /> Use demo data
          </button>
          <button class="button-primary" type="submit" :disabled="connection.state.connecting">
            <RefreshCw v-if="connection.state.connecting" class="spin" :size="17" aria-hidden="true" />
            <Cable v-else :size="17" aria-hidden="true" />
            {{ connection.state.connecting ? 'Connecting…' : 'Connect' }}
          </button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.app-frame {
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 20;
  display: flex;
  width: var(--sidebar-width);
  flex-direction: column;
  border-right: 1px solid var(--line);
  background: var(--surface-rail);
}

.brand {
  display: flex;
  height: 68px;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  color: var(--text-strong);
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--line-strong);
  border-radius: 9px;
  color: var(--accent-strong);
}

.brand-word {
  font-size: 20px;
  font-weight: 680;
  letter-spacing: -0.03em;
}

.primary-nav {
  display: grid;
  gap: 4px;
  padding: 10px 10px;
}

.nav-link {
  position: relative;
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 13px;
  padding: 0 13px;
  border-radius: 8px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 160ms ease, background 160ms ease;
}

.nav-link:hover {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.nav-link.router-link-exact-active {
  color: var(--text-strong);
  background: var(--surface-selected);
}

.nav-link.router-link-exact-active::before {
  position: absolute;
  inset: 10px auto 10px -10px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
  content: '';
}

.connection-card {
  position: relative;
  display: grid;
  gap: 3px;
  min-height: 104px;
  margin: auto 10px 14px;
  padding: 14px 36px 14px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  text-align: left;
  cursor: pointer;
}

.connection-card:hover {
  border-color: var(--line-strong);
  background: var(--surface-panel);
}

.connection-line {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-strong);
}

.connection-line strong {
  font-weight: 600;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.connection-dot.is-live,
.connection-dot.is-demo {
  background: var(--accent);
}

.connection-dot.is-reauth {
  background: var(--warning);
}

.connection-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-version {
  font-size: 12px;
}

.connection-arrow {
  position: absolute;
  top: 42px;
  right: 12px;
}

.workspace {
  min-height: 100vh;
  margin-left: var(--sidebar-width);
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 15;
  display: flex;
  height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 var(--content-gutter);
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-canvas) 94%, transparent);
}

.topbar-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.topbar h1 {
  margin: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 19px;
  font-weight: 590;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-brand {
  display: none;
  color: var(--text-strong);
  font-size: 19px;
  font-weight: 680;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-action,
.configure-action,
.button-primary,
.button-secondary {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.icon-action {
  width: 42px;
  background: transparent;
  color: var(--text-muted);
}

.labeled-action {
  width: auto;
  padding: 0 9px;
}

.labeled-action span {
  font-size: 12px;
  font-weight: 560;
}

.icon-action:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.configure-action {
  padding: 0 12px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text);
}

.configure-action:hover {
  border-color: var(--line-strong);
  background: var(--surface-hover);
}

.mode-badge {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 600;
}

.mode-badge.is-reauth {
  background: var(--warning-soft);
  color: var(--warning);
}

.main-content {
  min-width: 0;
  padding: 18px var(--content-gutter) 32px;
}

.mobile-dock,
.mobile-sheet-layer {
  display: none;
}

.connection-dialog {
  width: min(520px, calc(100vw - 32px));
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 14px;
  background: var(--surface-panel);
  color: var(--text);
  box-shadow: var(--shadow-layer);
}

.connection-dialog::backdrop {
  background: rgba(3, 8, 14, 0.7);
  backdrop-filter: blur(4px);
}

.connection-form {
  display: grid;
  gap: 20px;
  padding: 22px;
}

.connection-form header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.connection-form h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 20px;
  letter-spacing: -0.02em;
}

.connection-form p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.field {
  display: grid;
  gap: 7px;
}

.field > span {
  color: var(--text-strong);
  font-weight: 580;
}

.field input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  outline: 0;
}

.field input:focus {
  border-color: var(--focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 18%, transparent);
}

.field small {
  color: var(--text-muted);
}

.form-error {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger) !important;
}

.connection-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.button-primary,
.button-secondary {
  padding: 0 14px;
}

.button-primary {
  background: var(--accent);
  color: #07150f;
  font-weight: 650;
}

.button-secondary {
  border: 1px solid var(--line-strong);
  background: transparent;
}

.button-primary:disabled {
  cursor: wait;
  opacity: 0.66;
}

.spin {
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1535px) and (min-width: 900px) {
  :global(:root) {
    --sidebar-width: 76px;
  }

  .brand {
    justify-content: center;
    padding: 0;
  }

  .brand-word,
  .nav-link span,
  .connection-card > :not(.connection-line),
  .connection-line strong,
  .connection-arrow {
    display: none;
  }

  .nav-link {
    justify-content: center;
    padding: 0;
  }

  .connection-card {
    min-height: 52px;
    place-items: center;
    padding: 0;
  }

  .connection-line {
    gap: 0;
  }
}

@media (max-width: 899px) {
  .sidebar {
    display: none;
  }

  .workspace {
    margin-left: 0;
    padding-bottom: calc(68px + env(safe-area-inset-bottom));
  }

  .topbar {
    height: 58px;
    padding: 0 14px;
  }

  .mobile-brand {
    display: inline;
  }

  .topbar-title h1::before {
    color: var(--text-muted);
    content: '/';
    margin-right: 10px;
  }

  .configure-action {
    display: none;
  }

  .labeled-action {
    width: 42px;
    padding: 0;
  }

  .labeled-action span {
    display: none;
  }

  .mode-badge {
    min-height: 28px;
    padding-inline: 8px;
    font-size: 11px;
  }

  .main-content {
    padding: 14px 12px 24px;
  }

  .mobile-dock {
    position: fixed;
    inset: auto 0 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    min-height: calc(64px + env(safe-area-inset-bottom));
    padding: 5px 6px env(safe-area-inset-bottom);
    border-top: 1px solid var(--line);
    background: var(--surface-rail);
  }

  .dock-link {
    display: flex;
    min-width: 0;
    min-height: 54px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    font-size: 10px;
    text-decoration: none;
  }

  .dock-link.router-link-exact-active {
    background: var(--surface-selected);
    color: var(--accent-strong);
  }

  .mobile-sheet-layer {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: flex-end;
    background: rgba(3, 8, 14, 0.58);
  }

  .mobile-sheet {
    width: 100%;
    padding: 10px 12px calc(20px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line-strong);
    border-radius: 16px 16px 0 0;
    background: var(--surface-panel);
    box-shadow: var(--shadow-layer);
  }

  .mobile-sheet header {
    display: flex;
    min-height: 52px;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 5px 12px;
    color: var(--text-strong);
  }

  .sheet-link {
    display: flex;
    width: 100%;
    min-height: 48px;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    border-radius: 8px;
    background: transparent;
    color: var(--text);
    text-decoration: none;
  }

  .sheet-link:hover {
    background: var(--surface-hover);
  }

  .connection-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .button-primary,
  .button-secondary {
    width: 100%;
  }
}
</style>
