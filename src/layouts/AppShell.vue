<script setup lang="ts">
/* global HTMLButtonElement, HTMLDialogElement, HTMLInputElement, HTMLElement, document */

import {
  Bell,
  Cable,
  ChevronRight,
  CircleGauge,
  FlaskConical,
  Fingerprint,
  KeyRound,
  Languages,
  Layers3,
  ListChecks,
  Menu,
  MonitorUp,
  Moon,
  RefreshCw,
  Router,
  Server,
  Settings2,
  ShieldCheck,
  SquareTerminal,
  Sun,
  X,
} from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { getPanelRuntimeConfig } from '@/api'
import { useI18n } from '@/i18n'
import { useConnection } from '@/stores/connection'
import { useTheme } from '@/stores/theme'
import { parseSshListenPort } from '@/utils/ssh-config'

const route = useRoute()
const queryClient = useQueryClient()
const connection = useConnection()
const theme = useTheme()
const { locale, t, toggleLocale } = useI18n()
const panelRuntime = getPanelRuntimeConfig()
const serviceUrl = panelRuntime.serviceUrl
const isOpenWrt = panelRuntime.deployment === 'openwrt'

const navItems = computed(() => [
  { name: 'overview', label: t('Overview'), to: '/', icon: CircleGauge },
  { name: 'assets', label: t('Assets'), to: '/assets', icon: Server },
  { name: 'credentials', label: t('Credentials'), to: '/credentials', icon: KeyRound },
  { name: 'access', label: t('Access'), to: '/access', icon: ShieldCheck },
  { name: 'sessions', label: t('Sessions'), to: '/sessions', icon: MonitorUp },
  { name: 'known-hosts', label: t('Host trust'), to: '/known-hosts', icon: Fingerprint },
  { name: 'alerts', label: t('Alerts'), to: '/alerts', icon: Bell },
  { name: 'audit', label: t('Audit'), to: '/audit', icon: ListChecks },
  { name: 'configuration', label: t('Settings'), to: '/configuration', icon: Settings2 },
])

const mobileItems = computed(() =>
  navItems.value.filter((item) =>
    ['overview', 'assets', 'access', 'sessions'].includes(item.name),
  ),
)
const moreActive = computed(() =>
  ['credentials', 'known-hosts', 'alerts', 'audit', 'configuration'].includes(String(route.name)),
)

const pageTitle = computed(() => t(String(route.meta.title ?? 'Hop')))
const sshPortPill = computed(() => {
  if (!connection.state.sshListen) return null
  return `SSH :${parseSshListenPort(connection.state.sshListen)}`
})

const connectionDialog = ref<HTMLDialogElement | null>(null)
const connectionTokenInput = ref<HTMLInputElement | null>(null)
const mobileMenuOpen = ref(false)
const mobileMenuButton = ref<HTMLButtonElement | null>(null)
const mobileMenuCloseButton = ref<HTMLButtonElement | null>(null)
const mobileMenuPreviousFocus = ref<HTMLElement | null>(null)
const endpoint = ref(connection.state.endpoint)
const token = ref('')
const submitError = ref('')
const refreshing = ref(false)

function openConnection() {
  submitError.value = ''
  connection.clearError()
  endpoint.value = connection.state.endpoint || endpoint.value
  token.value = ''
  connectionDialog.value?.showModal()
  void nextTick(() => connectionTokenInput.value?.focus({ preventScroll: true }))
}

function closeConnection() {
  connectionDialog.value?.close()
}

async function submitConnection() {
  submitError.value = ''
  try {
    await connection.connectToHop(endpoint.value, token.value)
  } catch (error) {
    submitError.value =
      error instanceof Error ? error.message : 'The instance could not be reached.'
    return
  }

  closeConnection()
  await nextTick()
  await queryClient.resetQueries()
}

async function switchToDemo() {
  connection.useDemo()
  closeConnection()
  await nextTick()
  await queryClient.resetQueries()
}

async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await queryClient.invalidateQueries()
  } finally {
    refreshing.value = false
  }
}

async function refreshFromMobileMenu() {
  await refresh()
  closeMobileMenu()
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

watch(mobileMenuOpen, async (open) => {
  if (open) {
    mobileMenuPreviousFocus.value =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    mobileMenuCloseButton.value?.focus({ preventScroll: true })
    return
  }

  const previousFocus = mobileMenuPreviousFocus.value
  mobileMenuPreviousFocus.value = null
  previousFocus?.focus({ preventScroll: true })
})

watch(
  () => route.fullPath,
  () => {
    if (mobileMenuOpen.value) closeMobileMenu()
  },
)

onBeforeUnmount(() => {
  mobileMenuPreviousFocus.value?.focus({ preventScroll: true })
})

onMounted(async () => {
  if (connection.state.mode !== 'reauth') return
  if (await connection.restoreConnection()) {
    await nextTick()
    await queryClient.resetQueries()
    return
  }
  await nextTick()
  openConnection()
})
</script>

<template>
  <div class="app-frame">
    <aside class="sidebar" :aria-label="t('Primary navigation')">
      <RouterLink class="brand" to="/" :aria-label="t('Hop overview')">
        <span class="brand-mark" aria-hidden="true"><Layers3 :size="17" /></span>
        <span class="brand-copy">
          <span class="brand-word">Hop</span>
          <small class="brand-tag mono">SSH Relay</small>
        </span>
      </RouterLink>

      <nav class="primary-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="nav-link"
          :aria-label="item.label"
        >
          <component :is="item.icon" :size="17" :stroke-width="1.85" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <button
        class="connection-card"
        type="button"
        :aria-label="`${t('Open instance connection')} · ${t(connection.state.mode === 'live' ? 'Connected' : connection.state.mode === 'reauth' ? 'Authentication required' : 'Demo data · Synthetic workspace')}`"
        @click="openConnection"
      >
        <span class="connection-line">
          <span
            class="connection-dot"
            :class="`is-${connection.state.mode}`"
            aria-hidden="true"
          />
          <strong>
            {{ t(
              connection.state.mode === 'live'
                ? 'Connected'
                : connection.state.mode === 'reauth'
                  ? 'Authenticate'
                  : 'Demo data'
            ) }}
          </strong>
        </span>
        <span class="connection-detail">
          {{ connection.state.mode === 'demo' ? t('Synthetic workspace') : connection.state.endpoint || t('This panel · same origin') }}
        </span>
        <span class="connection-version mono tabular">
          {{ connection.state.version ?? (connection.state.mode === 'reauth' ? t('Token required') : 'v0.3.0') }}
        </span>
        <ChevronRight class="connection-arrow" :size="16" aria-hidden="true" />
      </button>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div class="topbar-title">
          <span class="topbar-brand" aria-hidden="true">Hop</span>
          <span class="topbar-sep" aria-hidden="true">/</span>
          <span class="topbar-crumb">{{ pageTitle }}</span>
        </div>
        <div class="topbar-actions">
          <span v-if="sshPortPill" class="ssh-pill mono tabular">
            <SquareTerminal :size="13" aria-hidden="true" />
            {{ sshPortPill }}
          </span>
          <span
            class="mode-badge"
            :class="`is-${connection.state.mode}`"
            role="status"
            aria-live="polite"
          >
            <FlaskConical v-if="connection.state.mode === 'demo'" :size="14" aria-hidden="true" />
            <Cable v-else :size="14" aria-hidden="true" />
            {{ t(connection.state.mode === 'demo' ? 'Demo workspace' : connection.state.mode === 'live' ? 'Connected' : 'Re-auth') }}
          </span>
          <button
            class="icon-action labeled-action"
            :class="{ 'is-refreshing': refreshing }"
            type="button"
            :aria-label="t('Refresh data')"
            :title="t('Refresh data')"
            :disabled="refreshing"
            :aria-busy="refreshing || undefined"
            @click="void refresh()"
          >
            <RefreshCw :size="16" aria-hidden="true" />
            <span>{{ t('Refresh') }}</span>
          </button>
          <button
            class="icon-action labeled-action"
            type="button"
            :aria-label="t('Use {theme} theme', { theme: t(theme.resolvedTheme.value === 'dark' ? 'Light' : 'Dark') })"
            :title="t('Use {theme} theme', { theme: t(theme.resolvedTheme.value === 'dark' ? 'Light' : 'Dark') })"
            @click="theme.toggleTheme"
          >
            <Sun v-if="theme.resolvedTheme.value === 'dark'" :size="16" aria-hidden="true" />
            <Moon v-else :size="16" aria-hidden="true" />
            <span>{{ t(theme.resolvedTheme.value === 'dark' ? 'Light' : 'Dark') }}</span>
          </button>
          <button
            class="icon-action labeled-action"
            type="button"
            :aria-label="locale === 'en' ? '切换到中文' : 'Switch to English'"
            :title="locale === 'en' ? '切换到中文' : 'Switch to English'"
            @click="toggleLocale"
          >
            <Languages :size="16" aria-hidden="true" />
            <span>{{ locale === 'en' ? '中文' : 'EN' }}</span>
          </button>
          <button class="configure-action" type="button" @click="openConnection">
            <Settings2 :size="15" aria-hidden="true" />
            {{ t('Instance') }}
          </button>
          <a v-if="serviceUrl" class="configure-action" :href="serviceUrl">
            <Router :size="15" aria-hidden="true" />
            {{ t('Router settings') }}
          </a>
        </div>
      </header>

      <main id="main-content" class="main-content">
        <div v-if="connection.state.insecureToken" class="token-warning" role="alert">
          <ShieldCheck :size="18" aria-hidden="true" />
          <span><strong>{{ t('Change the webpage management Token.') }}</strong> {{ t('The connected instance still uses the insecure change-me placeholder.') }}</span>
        </div>
        <slot />
      </main>
    </section>

    <nav class="mobile-dock" :aria-label="t('Mobile navigation')">
      <RouterLink v-for="item in mobileItems" :key="item.name" :to="item.to" class="dock-link">
        <component :is="item.icon" :size="19" :stroke-width="1.8" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </RouterLink>
      <button
        ref="mobileMenuButton"
        class="dock-link"
        :class="{ 'is-active': moreActive }"
        type="button"
        :aria-current="moreActive ? 'page' : undefined"
        :aria-expanded="mobileMenuOpen"
        aria-controls="mobile-more-menu"
        @click="mobileMenuOpen = true"
      >
        <Menu :size="19" aria-hidden="true" />
        <span>{{ t('More') }}</span>
      </button>
    </nav>

    <div v-if="mobileMenuOpen" class="mobile-sheet-layer" @click.self="closeMobileMenu" @keydown.esc="closeMobileMenu">
      <section id="mobile-more-menu" class="mobile-sheet" :aria-label="t('More navigation')" tabindex="-1">
        <header>
          <strong>{{ t('More') }}</strong>
          <button ref="mobileMenuCloseButton" class="icon-action" type="button" :aria-label="t('Close menu')" @click="closeMobileMenu">
            <X :size="18" aria-hidden="true" />
          </button>
        </header>
        <RouterLink class="sheet-link" to="/credentials" @click="closeMobileMenu">
          <KeyRound :size="18" aria-hidden="true" /> {{ t('Credentials') }}
        </RouterLink>
        <RouterLink class="sheet-link" to="/known-hosts" @click="closeMobileMenu">
          <Fingerprint :size="18" aria-hidden="true" /> {{ t('Host trust') }}
        </RouterLink>
        <RouterLink class="sheet-link" to="/alerts" @click="closeMobileMenu">
          <Bell :size="18" aria-hidden="true" /> {{ t('Alerts') }}
        </RouterLink>
        <RouterLink class="sheet-link" to="/audit" @click="closeMobileMenu">
          <ListChecks :size="18" aria-hidden="true" /> {{ t('Audit') }}
        </RouterLink>
        <RouterLink class="sheet-link" to="/configuration" @click="closeMobileMenu">
          <Settings2 :size="18" aria-hidden="true" /> {{ t('Settings') }}
        </RouterLink>
        <button class="sheet-link compact-only" type="button" :disabled="refreshing" @click="void refreshFromMobileMenu()">
          <RefreshCw :size="18" :class="{ 'is-refreshing': refreshing }" aria-hidden="true" /> {{ t('Refresh') }}
        </button>
        <button class="sheet-link compact-only" type="button" @click="theme.toggleTheme">
          <Sun v-if="theme.resolvedTheme.value === 'dark'" :size="18" aria-hidden="true" />
          <Moon v-else :size="18" aria-hidden="true" />
          {{ t(theme.resolvedTheme.value === 'dark' ? 'Light' : 'Dark') }}
        </button>
        <button class="sheet-link compact-only" type="button" @click="toggleLocale">
          <Languages :size="18" aria-hidden="true" /> {{ locale === 'en' ? '中文' : 'EN' }}
        </button>
        <button class="sheet-link" type="button" @click="closeMobileMenu(); openConnection()">
          <Cable :size="18" aria-hidden="true" /> {{ t('Instance connection') }}
        </button>
        <a v-if="serviceUrl" class="sheet-link" :href="serviceUrl">
          <Router :size="18" aria-hidden="true" /> {{ t('Router settings') }}
        </a>
      </section>
    </div>

    <dialog ref="connectionDialog" class="connection-dialog" @click.self="closeConnection">
      <form class="connection-form" @submit.prevent="submitConnection">
        <header>
          <div>
            <h2>{{ t('Connect to Hop') }}</h2>
            <p>{{ t(isOpenWrt ? 'Enter the webpage management Token from the OpenWrt service configuration.' : 'Enter the webpage management Token from hop.yaml.') }}</p>
          </div>
          <button class="icon-action" type="button" :aria-label="t('Close connection settings')" @click="closeConnection">
            <X :size="18" aria-hidden="true" />
          </button>
        </header>

        <label class="field">
          <span>{{ t('Webpage management Token') }}</span>
          <input ref="connectionTokenInput" v-model="token" name="management-token" type="password" autocomplete="off" spellcheck="false" required autofocus />
          <small>{{ t(isOpenWrt ? 'LuCI forwards it only to the loopback Hop API and remembers it for this tab session.' : "The browser sends it to this panel's Origin and remembers it for this tab session.") }}</small>
        </label>

        <p v-if="token === 'change-me'" class="placeholder-warning" role="alert">
          {{ t(isOpenWrt ? 'OpenWrt placeholder replace warning' : 'This placeholder works for first use but is not safe. Replace it in hop.yaml.') }}
        </p>

        <details class="advanced-connection">
          <summary>{{ t('Connect to another instance') }}</summary>
          <label class="field">
            <span>{{ t('Remote Control API URL') }}</span>
            <input v-model="endpoint" name="remote-api-endpoint" type="url" inputmode="url" autocomplete="url" placeholder="https://hop.example.com" />
            <small>{{ t('Leave empty for the recommended same-origin Compose connection.') }}</small>
          </label>
        </details>

        <p v-if="submitError || connection.state.error" class="form-error" role="alert">
          {{ submitError || connection.state.error }}
        </p>

        <div class="connection-actions">
          <button class="button-secondary" type="button" @click="switchToDemo">
            <FlaskConical :size="16" aria-hidden="true" /> {{ t('Use demo data') }}
          </button>
          <button class="button-primary" type="submit" :disabled="connection.state.connecting">
            <RefreshCw v-if="connection.state.connecting" class="spin" :size="16" aria-hidden="true" />
            <Cable v-else :size="16" aria-hidden="true" />
            {{ t(connection.state.connecting ? 'Connecting…' : 'Connect') }}
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
  height: 58px;
  align-items: center;
  gap: 11px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line-subtle);
  color: var(--text-strong);
  text-decoration: none;
}

.brand-mark {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--line-strong));
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.brand-copy {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 7px;
}

.brand-word {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.brand-tag {
  color: var(--text-muted);
  font-size: 10.5px;
  font-weight: 550;
}

.primary-nav {
  display: grid;
  gap: 2px;
  padding: 10px 10px;
}

.nav-link {
  position: relative;
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 11px;
  padding: 0 11px;
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 550;
  text-decoration: none;
  transition: color 140ms ease, background-color 140ms ease;
}

.nav-link:hover {
  color: var(--text-strong);
  background: var(--surface-hover);
}

.nav-link.router-link-exact-active {
  color: var(--text-strong);
  background: var(--surface-selected);
  font-weight: 620;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.nav-link.router-link-exact-active svg {
  color: var(--accent-strong);
}

.connection-card {
  position: relative;
  display: grid;
  gap: 3px;
  margin: auto 10px 12px;
  padding: 11px 32px 11px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-panel);
  box-shadow: var(--panel-highlight);
  color: var(--text-muted);
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.connection-card:hover {
  border-color: var(--line-strong);
  background: var(--surface-raised);
}

.connection-line {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-strong);
  font-size: 12.5px;
}

.connection-line strong {
  font-weight: 620;
}

.connection-dot {
  width: 7px;
  height: 7px;
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
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-version {
  font-size: 11px;
  color: var(--text-muted);
}

.connection-arrow {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
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
  height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 var(--content-gutter);
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface-canvas) 90%, transparent);
  backdrop-filter: blur(8px);
}

.topbar-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}

.topbar-brand {
  color: var(--text-muted);
  font-weight: 620;
}

.topbar-sep {
  color: var(--line-strong);
}

.topbar-crumb {
  overflow: hidden;
  color: var(--text-strong);
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ssh-pill {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface-panel);
  color: var(--text);
  font-size: 11.5px;
  font-weight: 560;
  white-space: nowrap;
}

.icon-action,
.configure-action,
.button-primary,
.button-secondary {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.icon-action {
  width: 34px;
  background: transparent;
  color: var(--text-muted);
  transition: background-color 140ms ease, color 140ms ease;
}

.icon-action:disabled {
  cursor: wait;
  opacity: 0.58;
}

.labeled-action {
  width: auto;
  padding: 0 8px;
}

.labeled-action span {
  font-size: 12px;
  font-weight: 560;
}

.icon-action:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.icon-action.is-refreshing svg,
.sheet-link .is-refreshing {
  animation: spin 800ms linear infinite;
}

.configure-action {
  padding: 0 10px;
  border: 1px solid var(--line);
  background: var(--surface-panel);
  color: var(--text);
  font-size: 12px;
  font-weight: 580;
  text-decoration: none;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.configure-action:hover {
  border-color: var(--line-strong);
  background: var(--surface-hover);
  color: var(--text-strong);
}

.mode-badge {
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

.mode-badge.is-reauth {
  border-color: color-mix(in srgb, var(--warning) 35%, var(--line));
  background: var(--warning-soft);
  color: var(--warning);
}

.main-content {
  min-width: 0;
  padding: 20px var(--content-gutter) 36px;
}

.token-warning {
  display: flex;
  max-width: 920px;
  align-items: flex-start;
  gap: 10px;
  margin: 0 0 16px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--warning) 42%, var(--line));
  border-radius: var(--radius-control);
  background: var(--warning-soft);
  color: var(--warning);
}

.token-warning svg {
  flex: 0 0 auto;
  margin-block-start: 1px;
}

.mobile-dock,
.mobile-sheet-layer {
  display: none;
}

.compact-only {
  display: none;
}

.connection-dialog {
  width: min(500px, calc(100vw - 28px));
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 13px;
  background: var(--surface-panel);
  color: var(--text);
  box-shadow: var(--panel-highlight), var(--shadow-layer);
}

.connection-dialog::backdrop {
  background: rgba(5, 9, 14, 0.72);
  backdrop-filter: blur(4px);
}

.connection-form {
  display: grid;
  gap: 18px;
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
  font-size: 19px;
  letter-spacing: -0.02em;
}

.connection-form p {
  margin: 4px 0 0;
  color: var(--text-muted);
}

.field {
  display: grid;
  gap: 6px;
}

.field > span {
  color: var(--text-strong);
  font-size: 12.5px;
  font-weight: 600;
}

.field input {
  width: 100%;
  height: 42px;
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
  font-size: 12px;
}

.placeholder-warning {
  margin: -4px 0 0 !important;
  padding: 10px 12px;
  border-radius: var(--radius-control);
  background: var(--warning-soft);
  color: var(--warning) !important;
}

.advanced-connection {
  border-top: 1px solid var(--line);
  padding-block-start: 14px;
}

.advanced-connection summary {
  color: var(--text);
  font-weight: 600;
  cursor: pointer;
}

.advanced-connection[open] summary {
  margin-block-end: 12px;
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
  gap: 8px;
}

.button-primary,
.button-secondary {
  min-height: 38px;
  padding: 0 14px;
  font-size: 13px;
}

.button-primary {
  background: var(--accent);
  color: var(--button-accent-foreground);
  font-weight: 650;
}

.button-secondary {
  border: 1px solid var(--line-strong);
  background: var(--surface-raised);
  color: var(--text-strong);
}

.button-primary:disabled {
  cursor: wait;
  opacity: 0.66;
}

.spin {
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Compact icon rail only on narrow tablets (900px–1059px); laptops >= 1060px keep full labels */
@media (max-width: 1059px) and (min-width: 900px) {
  :global(:root) {
    --sidebar-width: 72px;
  }

  .brand {
    justify-content: center;
    padding: 0;
  }

  .brand-copy,
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
    min-height: 46px;
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
    height: 54px;
    padding: 0 14px;
  }

  .topbar-brand {
    color: var(--text-strong);
    font-weight: 700;
  }

  .ssh-pill,
  .configure-action {
    display: none;
  }

  .labeled-action {
    width: 38px;
    padding: 0;
  }

  .labeled-action span {
    display: none;
  }

  .mode-badge {
    min-height: 26px;
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
    min-height: calc(62px + env(safe-area-inset-bottom));
    padding: 4px 6px env(safe-area-inset-bottom);
    border-top: 1px solid var(--line);
    background: var(--surface-rail);
  }

  .dock-link {
    display: flex;
    min-width: 0;
    min-height: 52px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border-radius: 8px;
    background: transparent;
    color: var(--text-muted);
    font-size: 10.5px;
    font-weight: 560;
    text-decoration: none;
  }

  .dock-link.router-link-exact-active,
  .dock-link.is-active {
    background: var(--surface-selected);
    color: var(--accent-strong);
  }

  .mobile-sheet-layer {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: flex-end;
    background: rgba(5, 9, 14, 0.62);
  }

  .mobile-sheet {
    width: 100%;
    padding: 10px 12px calc(18px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line-strong);
    border-radius: 16px 16px 0 0;
    background: var(--surface-panel);
    box-shadow: var(--shadow-layer);
  }

  .mobile-sheet header {
    display: flex;
    min-height: 48px;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 4px 12px;
    color: var(--text-strong);
  }

  .sheet-link {
    display: flex;
    width: 100%;
    min-height: 46px;
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

  .sheet-link:disabled {
    cursor: wait;
    opacity: 0.58;
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

@media (max-width: 620px) {
  .topbar-actions .labeled-action {
    display: none;
  }

  .compact-only {
    display: flex;
  }
}
</style>
