<script setup lang="ts">
/* global HTMLDialogElement, HTMLElement, document, navigator, setTimeout, clearTimeout */

import { Check, Copy, KeyRound, ShieldCheck, X } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import { BaseButton, InlineNotice, StatusBadge } from '@/components/ui'
import type { Asset, BootstrapKeyInput, BootstrapKeyResult, Credential } from '@/domain'
import { useI18n } from '@/i18n'
import { useBootstrapAssetKeyMutation } from '@/queries'

const props = defineProps<{
  open: boolean
  asset: Asset | null
  boundCredential: Credential | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const bootstrapMutation = useBootstrapAssetKeyMutation()
const uid = useId()
const titleId = `bootstrap-key-title-${uid}`

const dialog = ref<HTMLDialogElement | null>(null)
const previousFocus = ref<HTMLElement | null>(null)

const authMode = ref<'bound' | 'password'>('password')
const username = ref('root')
const password = ref('')
const credentialName = ref('')
const prunePreviousCredential = ref(true)
const disablePasswordAuth = ref(false)
const errorText = ref('')
const result = ref<BootstrapKeyResult | null>(null)
const copiedKey = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

const defaultCredentialPlaceholder = computed(() =>
  props.asset?.name ? `${props.asset.name}-ed25519` : 'vps-ed25519',
)

function resetState() {
  authMode.value = props.boundCredential ? 'bound' : 'password'
  username.value = props.boundCredential?.username || 'root'
  password.value = ''
  credentialName.value = ''
  prunePreviousCredential.value = true
  disablePasswordAuth.value = false
  errorText.value = ''
  result.value = null
  copiedKey.value = false
}

function close() {
  emit('update:open', false)
}

function restoreFocus() {
  previousFocus.value?.focus({ preventScroll: true })
  previousFocus.value = null
}

async function copyPublicKey() {
  if (!result.value || !navigator.clipboard) return
  await navigator.clipboard.writeText(result.value.publicKey)
  copiedKey.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copiedKey.value = false
  }, 1800)
}

async function submitBootstrap() {
  if (!props.asset) return
  errorText.value = ''

  const useBound = Boolean(props.boundCredential) && authMode.value === 'bound'
  if (!useBound) {
    if (!username.value.trim()) {
      errorText.value = t('Enter the target account username.')
      return
    }
    if (!password.value) {
      errorText.value = t('Enter the password that Hop should store.')
      return
    }
  }

  const input: BootstrapKeyInput = {
    username: useBound ? null : username.value.trim(),
    password: useBound ? null : password.value,
    credentialName: credentialName.value.trim() || null,
    prunePreviousCredential: prunePreviousCredential.value,
    disablePasswordAuth: disablePasswordAuth.value,
  }

  try {
    const response = await bootstrapMutation.mutateAsync({
      id: props.asset.id,
      input,
    })
    password.value = ''
    result.value = response
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : t('SSH key bootstrap failed')
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    await nextTick()
    const element = dialog.value
    if (!element) return
    if (isOpen) {
      resetState()
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
    class="bootstrap-dialog"
    :aria-labelledby="titleId"
    @cancel.prevent="close"
    @click.self="close"
    @close="emit('update:open', false)"
  >
    <div class="bootstrap-surface">
      <header class="bootstrap-header">
        <span class="bootstrap-mark" aria-hidden="true">
          <KeyRound :size="19" />
        </span>
        <div class="bootstrap-heading">
          <div class="bootstrap-heading__title">
            <h2 :id="titleId">{{ t('Bootstrap SSH key') }}</h2>
            <span v-if="props.asset" class="mono target-chip">{{ props.asset.name }}</span>
            <span v-if="props.asset?.viaAssetName" class="via-pill">
              via {{ props.asset.viaAssetName }}
            </span>
          </div>
          <p>{{ t('One-click Ed25519 key enrollment and password rotation.') }}</p>
        </div>
        <button
          class="bootstrap-close"
          type="button"
          :aria-label="t('Close bootstrap dialog')"
          @click="close"
        >
          <X :size="18" aria-hidden="true" />
        </button>
      </header>

      <div v-if="result" class="bootstrap-body">
        <InlineNotice tone="success" :title="t('SSH key bootstrap succeeded')">
          <p>{{ t('Independent key login verified') }}</p>
        </InlineNotice>

        <InlineNotice
          v-for="(warning, idx) in result.warnings"
          :key="idx"
          tone="warning"
        >
          <p>{{ warning }}</p>
        </InlineNotice>

        <dl class="result-facts">
          <div>
            <dt>{{ t('Independent key login verified') }}</dt>
            <dd>
              <StatusBadge :label="t(result.verifiedKeyLogin ? 'Ready' : 'Failed')" :tone="result.verifiedKeyLogin ? 'success' : 'danger'" />
            </dd>
          </div>
          <div>
            <dt>{{ t('Bound credential') }}</dt>
            <dd class="mono">{{ result.credential.name }} · {{ result.credential.username }}</dd>
          </div>
          <div>
            <dt>{{ t('Public-key fingerprint') }}</dt>
            <dd class="mono">{{ result.publicKeyFingerprint }}</dd>
          </div>
          <div>
            <dt>{{ t('Previous credential pruned') }}</dt>
            <dd>
              <StatusBadge
                :label="t(result.prunedPreviousCredential ? 'Enabled' : 'Not used')"
                :tone="result.prunedPreviousCredential ? 'info' : 'neutral'"
              />
            </dd>
          </div>
          <div>
            <dt>{{ t('sshd password auth disabled') }}</dt>
            <dd>
              <StatusBadge
                :label="t(result.passwordAuthDisabled ? 'Disabled' : 'Not used')"
                :tone="result.passwordAuthDisabled ? 'success' : 'neutral'"
              />
            </dd>
          </div>
        </dl>

        <div class="pubkey-section">
          <span class="pubkey-label">{{ t('Installed public key') }}</span>
          <div class="code-snippet">
            <code :title="result.publicKey">{{ result.publicKey }}</code>
            <BaseButton size="sm" variant="secondary" @click="void copyPublicKey()">
              <template #leading>
                <Check v-if="copiedKey" />
                <Copy v-else />
              </template>
              {{ t(copiedKey ? 'Copied' : 'Copy public key') }}
            </BaseButton>
          </div>
        </div>

        <footer class="bootstrap-footer">
          <BaseButton variant="primary" @click="close">{{ t('Done') }}</BaseButton>
        </footer>
      </div>

      <form v-else class="bootstrap-body" @submit.prevent="void submitBootstrap()">
        <div class="safety-banner">
          <ShieldCheck :size="17" aria-hidden="true" />
          <p>{{ t('Bootstrap safety explanation') }}</p>
        </div>

        <InlineNotice v-if="errorText" tone="danger" :title="t('SSH key bootstrap failed')">
          <p>{{ errorText }}</p>
        </InlineNotice>

        <div v-if="props.boundCredential" class="auth-mode-block">
          <div class="segmented-control" role="group" :aria-label="t('Authentication')">
            <button
              type="button"
              :class="{ 'is-active': authMode === 'bound' }"
              :aria-pressed="authMode === 'bound'"
              @click="authMode = 'bound'"
            >
              {{ t('Use bound credential') }}
            </button>
            <button
              type="button"
              :class="{ 'is-active': authMode === 'password' }"
              :aria-pressed="authMode === 'password'"
              @click="authMode = 'password'"
            >
              {{ t('One-time password') }}
            </button>
          </div>
          <p v-if="authMode === 'bound'" class="bound-hint">
            {{
              t('Leave blank to authenticate with the bound credential ({name}).', {
                name: `${props.boundCredential.name} · ${props.boundCredential.username}`,
              })
            }}
          </p>
        </div>

        <div v-if="!props.boundCredential || authMode === 'password'" class="field-row">
          <label class="bootstrap-field">
            <span>{{ t('Initial SSH username') }}</span>
            <input v-model="username" name="bootstrap-username" autocomplete="off" spellcheck="false" />
          </label>
          <label class="bootstrap-field">
            <span>{{ t('Initial SSH password') }}</span>
            <input v-model="password" name="bootstrap-password" type="password" autocomplete="new-password" />
          </label>
        </div>

        <label class="bootstrap-field">
          <span>{{ t('New credential name (optional)') }}</span>
          <input
            v-model="credentialName"
            name="bootstrap-credential-name"
            autocomplete="off"
            spellcheck="false"
            :placeholder="defaultCredentialPlaceholder"
          />
        </label>

        <div class="check-group">
          <label class="check-card">
            <input v-model="prunePreviousCredential" name="prune-previous-credential" type="checkbox" />
            <div>
              <strong>{{ t('Prune previous unused local credential') }}</strong>
            </div>
          </label>

          <label class="check-card">
            <input v-model="disablePasswordAuth" name="disable-password-auth" type="checkbox" />
            <div>
              <strong>{{ t('Disable sshd PasswordAuthentication after key verification') }}</strong>
              <small>{{ t('Requires root or passwordless sudo; validated with sshd -t before reload.') }}</small>
            </div>
          </label>
        </div>

        <footer class="bootstrap-footer">
          <BaseButton variant="secondary" @click="close">{{ t('Cancel') }}</BaseButton>
          <BaseButton
            variant="primary"
            type="submit"
            :loading="bootstrapMutation.isPending.value"
            :loading-label="t('Bootstrapping…')"
          >
            <template #leading><KeyRound /></template>
            {{ t('Run SSH key bootstrap') }}
          </BaseButton>
        </footer>
      </form>
    </div>
  </dialog>
</template>

<style scoped>
.bootstrap-dialog {
  width: min(620px, calc(100vw - 24px));
  max-width: none;
  max-height: calc(100dvh - 28px);
  padding: 0;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: var(--text);
}

.bootstrap-dialog::backdrop {
  background: rgba(5, 9, 14, 0.72);
  backdrop-filter: blur(4px);
}

.bootstrap-surface {
  display: grid;
  max-height: calc(100dvh - 28px);
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 13px;
  background: var(--surface-panel);
  box-shadow: var(--panel-highlight), var(--shadow-layer);
}

.bootstrap-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 18px 20px 16px;
  border-bottom: 1px solid var(--line);
}

.bootstrap-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--line));
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.bootstrap-heading__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.bootstrap-heading h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.target-chip {
  padding: 2px 7px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--text-strong);
  font-size: 12px;
}

.bootstrap-heading p {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.bootstrap-close {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.bootstrap-close:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.bootstrap-body {
  display: grid;
  gap: 14px;
  overflow: auto;
  padding: 16px 20px 20px;
}

.safety-banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
  border-radius: 9px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.safety-banner p {
  margin: 0;
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.5;
}

.auth-mode-block {
  display: grid;
  gap: 8px;
}

.bound-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12.5px;
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.bootstrap-field {
  display: grid;
  gap: 5px;
}

.bootstrap-field > span,
.pubkey-label {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 600;
}

.bootstrap-field input {
  width: 100%;
  height: 38px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  font-size: 13px;
  outline: 0;
}

.bootstrap-field input:focus {
  border-color: var(--focus);
}

.check-group {
  display: grid;
  gap: 8px;
}

.check-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-input);
  cursor: pointer;
}

.check-card input[type='checkbox'] {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: var(--accent);
}

.check-card div {
  display: grid;
  gap: 2px;
}

.check-card strong {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 590;
}

.check-card small {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.result-facts {
  display: grid;
  margin: 0;
  padding: 4px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-input);
}

.result-facts > div {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--line);
}

.result-facts > div:last-child {
  border-bottom: 0;
}

.result-facts dt {
  color: var(--text-muted);
  font-size: 12.5px;
}

.result-facts dd {
  margin: 0;
  color: var(--text-strong);
  font-size: 12.5px;
  text-align: right;
  overflow-wrap: anywhere;
}

.pubkey-section {
  display: grid;
  gap: 6px;
}

.bootstrap-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

@media (max-width: 560px) {
  .field-row {
    grid-template-columns: 1fr;
  }

  .segmented-control {
    display: grid;
    grid-template-columns: 1fr;
  }

  .bootstrap-footer {
    display: grid;
    grid-template-columns: 1fr;
  }

  .bootstrap-footer :deep(.base-button) {
    width: 100%;
  }
}
</style>
