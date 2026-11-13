<script setup lang="ts">
/* global HTMLDialogElement, HTMLElement, Blob, URL, document, navigator, setTimeout, clearTimeout */

import { Check, Copy, Download, SquareTerminal, X } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import { BaseButton } from '@/components/ui'
import type { Asset, Credential } from '@/domain'
import { useI18n } from '@/i18n'
import { useConnection } from '@/stores/connection'
import {
  buildSshConfigSnippet,
  inferDefaultHopHost,
  parseSshListenPort,
  type SshConfigMode,
} from '@/utils/ssh-config'

const props = defineProps<{
  open: boolean
  assets: Asset[]
  credentials: Credential[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const connection = useConnection()
const { t } = useI18n()
const uid = useId()
const titleId = `ssh-config-title-${uid}`

const dialog = ref<HTMLDialogElement | null>(null)
const previousFocus = ref<HTMLElement | null>(null)

const mode = ref<SshConfigMode>('relay')
const hopHost = ref(
  inferDefaultHopHost(connection.state.endpoint, globalThis.location?.hostname),
)
const hopPort = ref(parseSshListenPort(connection.state.sshListen))
const identityFile = ref('')
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const snippet = computed(() =>
  buildSshConfigSnippet(props.assets, props.credentials, {
    hopHost: hopHost.value,
    hopPort: hopPort.value,
    mode: mode.value,
    identityFile: identityFile.value,
  }),
)

const cliCommand = computed(() => {
  const host = hopHost.value.trim() || 'hop.example.com'
  const portPart = hopPort.value === 2222 ? '' : ` --port ${hopPort.value}`
  const modePart = mode.value === 'relay' ? '' : ' --mode proxyjump'
  const keyPart = identityFile.value.trim() ? ` -i ${identityFile.value.trim()}` : ''
  return `hop-server ssh-config --host ${host}${portPart}${modePart}${keyPart}`
})

function close() {
  emit('update:open', false)
}

function restoreFocus() {
  previousFocus.value?.focus({ preventScroll: true })
  previousFocus.value = null
}

async function copySnippet() {
  if (!navigator.clipboard) return
  await navigator.clipboard.writeText(snippet.value)
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 1800)
}

function downloadSnippet() {
  const blob = new Blob([snippet.value], { type: 'text/plain;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `hop-ssh-${mode.value}.conf`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

watch(
  () => props.open,
  async (isOpen) => {
    await nextTick()
    const element = dialog.value
    if (!element) return
    if (isOpen) {
      hopHost.value = inferDefaultHopHost(
        connection.state.endpoint,
        globalThis.location?.hostname,
      )
      hopPort.value = parseSshListenPort(connection.state.sshListen)
      previousFocus.value =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (!element.open) {
        if (typeof element.showModal === 'function') element.showModal()
        else element.setAttribute('open', '')
      }
    } else if (element.open || element.hasAttribute('open')) {
      if (typeof element.close === 'function') element.close()
      else element.removeAttribute('open')
      restoreFocus()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
  const element = dialog.value
  if (element?.open && typeof element.close === 'function') element.close()
  restoreFocus()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="ssh-config-dialog"
    :aria-labelledby="titleId"
    @cancel.prevent="close"
    @click.self="close"
    @close="emit('update:open', false)"
  >
    <div class="ssh-config-surface">
      <header class="ssh-config-header">
        <span class="ssh-config-mark" aria-hidden="true">
          <SquareTerminal :size="19" />
        </span>
        <div class="ssh-config-heading">
          <h2 :id="titleId">{{ t('SSH Config generator') }}</h2>
          <p>{{ t('Generate ~/.ssh/config entries for native ssh, scp, sftp, Cursor, or VS Code.') }}</p>
        </div>
        <button
          class="ssh-config-close"
          type="button"
          :aria-label="t('Close SSH Config dialog')"
          @click="close"
        >
          <X :size="18" aria-hidden="true" />
        </button>
      </header>

      <div class="ssh-config-body">
        <div class="mode-row">
          <div class="segmented-control" role="group" :aria-label="t('Mode')">
            <button
              type="button"
              :class="{ 'is-active': mode === 'relay' }"
              :aria-pressed="mode === 'relay'"
              @click="mode = 'relay'"
            >
              {{ t('Vault Relay') }}
            </button>
            <button
              type="button"
              :class="{ 'is-active': mode === 'proxyjump' }"
              :aria-pressed="mode === 'proxyjump'"
              @click="mode = 'proxyjump'"
            >
              {{ t('ProxyJump · Remote IDE') }}
            </button>
          </div>
          <p class="mode-note">
            {{ t(mode === 'relay' ? 'Vault Relay mode explanation' : 'ProxyJump mode explanation') }}
          </p>
        </div>

        <div class="options-grid">
          <label class="config-field">
            <span>{{ t('Hop SSH host') }}</span>
            <input v-model="hopHost" name="hop-ssh-host" spellcheck="false" autocomplete="off" placeholder="hop.example.com" />
          </label>
          <label class="config-field">
            <span>{{ t('Hop SSH port') }}</span>
            <input v-model.number="hopPort" name="hop-ssh-port" type="number" min="1" max="65535" />
          </label>
          <label class="config-field config-field--wide">
            <span>{{ t('Local IdentityFile (optional)') }}</span>
            <input v-model="identityFile" name="local-identity-file" spellcheck="false" autocomplete="off" placeholder="~/.ssh/id_ed25519" />
          </label>
        </div>

        <div v-if="props.assets.length === 0" class="empty-note">
          {{ t('No SSH or TCP assets in Catalog yet.') }}
        </div>
        <div v-else class="snippet-wrap">
          <div class="snippet-bar">
            <span class="mono">~/.ssh/config</span>
            <div class="snippet-actions">
              <BaseButton size="sm" variant="secondary" @click="downloadSnippet">
                <template #leading><Download /></template>
                {{ t('Download config') }}
              </BaseButton>
              <BaseButton size="sm" variant="primary" @click="copySnippet">
                <template #leading>
                  <Check v-if="copied" />
                  <Copy v-else />
                </template>
                {{ t(copied ? 'Copied' : 'Copy config') }}
              </BaseButton>
            </div>
          </div>
          <pre class="snippet-code mono"><code>{{ snippet }}</code></pre>
        </div>

        <div class="cli-hint">
          <span class="cli-hint__label">{{ t('CLI equivalent') }}</span>
          <code class="mono">{{ cliCommand }}</code>
        </div>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.ssh-config-dialog {
  width: min(680px, calc(100vw - 24px));
  max-width: none;
  max-height: calc(100dvh - 28px);
  padding: 0;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: var(--text);
}

.ssh-config-dialog::backdrop {
  background: rgba(5, 9, 14, 0.72);
  backdrop-filter: blur(4px);
}

.ssh-config-surface {
  display: grid;
  max-height: calc(100dvh - 28px);
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 13px;
  background: var(--surface-panel);
  box-shadow: var(--panel-highlight), var(--shadow-layer);
}

.ssh-config-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--line);
}

.ssh-config-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--line));
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.ssh-config-heading h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.ssh-config-heading p {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.ssh-config-close {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.ssh-config-close:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.ssh-config-body {
  display: grid;
  gap: 14px;
  overflow: auto;
  padding: 16px 20px 20px;
}

.mode-row {
  display: grid;
  gap: 8px;
}

.mode-note {
  margin: 0;
  color: var(--text-muted);
  font-size: 12.5px;
}

.options-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px;
  gap: 10px;
}

.config-field {
  display: grid;
  gap: 5px;
}

.config-field--wide {
  grid-column: 1 / -1;
}

.config-field > span {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 600;
}

.config-field input {
  width: 100%;
  height: 38px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  font-family: var(--font-mono);
  font-size: 12.5px;
  outline: 0;
}

.config-field input:focus {
  border-color: var(--focus);
}

.snippet-wrap {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-input);
}

.snippet-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px 8px 13px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-raised);
  color: var(--text-muted);
  font-size: 12px;
}

.snippet-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.snippet-code {
  max-height: 270px;
  margin: 0;
  overflow: auto;
  padding: 13px 14px;
  color: var(--text-strong);
  font-size: 12px;
  line-height: 1.55;
}

.empty-note {
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-input);
  color: var(--text-muted);
  text-align: center;
}

.cli-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding-top: 2px;
  color: var(--text-muted);
  font-size: 12px;
}

.cli-hint__label {
  font-weight: 600;
}

.cli-hint code {
  overflow-wrap: anywhere;
  color: var(--text);
}

@media (max-width: 560px) {
  .options-grid {
    grid-template-columns: 1fr;
  }

  .segmented-control {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
