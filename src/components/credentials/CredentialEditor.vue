<script setup lang="ts">
import { KeyRound, LockKeyhole, RotateCw, ShieldCheck } from '@lucide/vue'
import { computed, reactive, watch } from 'vue'

import { BaseButton, FormField, InlineNotice } from '@/components/ui'
import type { Credential, CredentialAuthType, CredentialWriteInput } from '@/domain'
import { useI18n } from '@/i18n'

const { t } = useI18n()

const props = defineProps<{
  mode: 'create' | 'rotate'
  credential?: Credential
  busy?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  cancel: []
  submit: [input: CredentialWriteInput]
}>()

interface FormState {
  name: string
  username: string
  authType: CredentialAuthType
  password: string
  privateKey: string
  passphrase: string
}

const form = reactive<FormState>({
  name: '',
  username: '',
  authType: 'password',
  password: '',
  privateKey: '',
  passphrase: '',
})

const fieldErrors = reactive<Partial<Record<keyof FormState, string>>>({})
const isManaged = computed(() => props.credential?.management?.mode === 'config')
const isRotate = computed(() => props.mode === 'rotate')
const heading = computed(() => t(isRotate.value ? 'Rotate credential' : 'New credential'))
const submitLabel = computed(() => t(isRotate.value ? 'Rotate secret' : 'Create credential'))
const secretLabel = computed(() => {
  if (form.authType === 'password') return t('New password')
  return t('New private key')
})

function reset() {
  form.name = props.credential?.name ?? ''
  form.username = props.credential?.username ?? ''
  form.authType = props.credential?.authType ?? 'password'
  form.password = ''
  form.privateKey = ''
  form.passphrase = ''
  clearErrors()
}

function clearErrors() {
  for (const key of Object.keys(fieldErrors) as Array<keyof FormState>) {
    delete fieldErrors[key]
  }
}

function validate() {
  clearErrors()

  if (!form.name.trim()) fieldErrors.name = t('Give this credential a recognizable name.')
  if (!form.username.trim()) fieldErrors.username = t('Enter the target account username.')

  if (form.authType === 'password' && !form.password) {
    fieldErrors.password = t('Enter the password that Hop should store.')
  }
  if (form.authType !== 'password' && !form.privateKey.trim()) {
    fieldErrors.privateKey = t('Paste the complete private key.')
  }
  if (form.authType === 'key_passphrase' && !form.passphrase) {
    fieldErrors.passphrase = t('Enter the passphrase for this private key.')
  }

  return Object.keys(fieldErrors).length === 0
}

function submit() {
  if (props.busy || isManaged.value || !validate()) return

  const input: CredentialWriteInput = {
    name: form.name.trim(),
    username: form.username.trim(),
    authType: form.authType,
  }

  if (form.authType === 'password') input.password = form.password
  if (form.authType !== 'password') input.privateKey = form.privateKey.trim()
  if (form.authType === 'key_passphrase') input.passphrase = form.passphrase

  emit('submit', input)
}

watch(
  () => [props.mode, props.credential?.id] as const,
  reset,
  { immediate: true },
)
</script>

<template>
  <section
    class="credential-editor"
    :aria-labelledby="`credential-editor-${props.mode}`"
  >
    <header class="credential-editor__header">
      <span
        class="credential-editor__mark"
        aria-hidden="true"
      >
        <RotateCw
          v-if="isRotate"
          :size="19"
        />
        <KeyRound
          v-else
          :size="19"
        />
      </span>
      <div>
        <h2 :id="`credential-editor-${props.mode}`">
          {{ heading }}
        </h2>
        <p>
          {{ t(isRotate
            ? 'The stored value is never revealed. Saving replaces it with the value entered here.'
            : 'Hop encrypts this secret at rest and only returns configuration status.') }}
        </p>
      </div>
    </header>

    <InlineNotice
      v-if="isManaged"
      tone="warning"
      :title="t('Managed by configuration')"
    >
      {{ t('Config credential editor explanation') }}
    </InlineNotice>

    <InlineNotice
      v-if="props.error"
      tone="danger"
      :title="t('Credential was not saved')"
    >
      {{ props.error }}
    </InlineNotice>

    <form
      class="credential-editor__form"
      novalidate
      @submit.prevent="submit"
    >
      <div
        v-if="isRotate"
        class="credential-editor__identity"
      >
        <div>
          <span>{{ t('Name') }}</span>
          <strong>{{ form.name }}</strong>
        </div>
        <div>
          <span>{{ t('Target account') }}</span>
          <strong>{{ form.username }}</strong>
        </div>
      </div>

      <template v-else>
        <FormField
          :label="t('Name')"
          v-bind="fieldErrors.name ? { error: fieldErrors.name } : {}"
          required
        >
          <template #default="{ controlProps }">
            <input
              v-model="form.name"
              v-bind="controlProps"
              autocomplete="off"
              placeholder="homelab-root"
              :disabled="props.busy"
            >
          </template>
        </FormField>

        <FormField
          :label="t('Target username')"
          v-bind="fieldErrors.username ? { error: fieldErrors.username } : {}"
          required
        >
          <template #default="{ controlProps }">
            <input
              v-model="form.username"
              v-bind="controlProps"
              autocomplete="off"
              placeholder="root"
              :disabled="props.busy"
            >
          </template>
        </FormField>

        <FormField
          :label="t('Authentication')"
          required
        >
          <template #default="{ controlProps }">
            <select
              v-model="form.authType"
              v-bind="controlProps"
              :disabled="props.busy"
            >
              <option value="password">
                {{ t('Password') }}
              </option>
              <option value="key">
                {{ t('Private key') }}
              </option>
              <option value="key_passphrase">
                {{ t('Private key + passphrase') }}
              </option>
            </select>
          </template>
        </FormField>
      </template>

      <FormField
        :label="secretLabel"
        v-bind="{
          ...(form.authType === 'password' && fieldErrors.password
            ? { error: fieldErrors.password }
            : form.authType !== 'password' && fieldErrors.privateKey
              ? { error: fieldErrors.privateKey }
              : {}),
          ...(isRotate ? { hint: t('The current secret remains unchanged until you save.') } : {}),
        }"
        required
      >
        <template #default="{ controlProps }">
          <input
            v-if="form.authType === 'password'"
            v-model="form.password"
            v-bind="controlProps"
            type="password"
            autocomplete="new-password"
            :placeholder="t('Enter a new password')"
            :disabled="props.busy || isManaged"
          >
          <textarea
            v-else
            v-model="form.privateKey"
            v-bind="controlProps"
            class="credential-editor__key"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            :disabled="props.busy || isManaged"
          />
        </template>
      </FormField>

      <FormField
        v-if="form.authType === 'key_passphrase'"
        :label="t('New passphrase')"
        v-bind="fieldErrors.passphrase ? { error: fieldErrors.passphrase } : {}"
        required
      >
        <template #default="{ controlProps }">
          <input
            v-model="form.passphrase"
            v-bind="controlProps"
            type="password"
            autocomplete="new-password"
            :placeholder="t('Enter the key passphrase')"
            :disabled="props.busy || isManaged"
          >
        </template>
      </FormField>

      <div class="credential-editor__boundary">
        <ShieldCheck
          :size="17"
          aria-hidden="true"
        />
        <span>{{ t('Secret form boundary') }}</span>
      </div>

      <footer class="credential-editor__actions">
        <BaseButton
          variant="quiet"
          :disabled="props.busy"
          @click="emit('cancel')"
        >
          {{ t('Cancel') }}
        </BaseButton>
        <BaseButton
          variant="primary"
          type="submit"
          :loading="props.busy"
          :disabled="isManaged"
          :loading-label="t(isRotate ? 'Rotating credential' : 'Creating credential')"
        >
          <template #leading>
            <LockKeyhole />
          </template>
          {{ submitLabel }}
        </BaseButton>
      </footer>
    </form>
  </section>
</template>

<style scoped>
.credential-editor {
  display: grid;
  gap: 18px;
}

.credential-editor__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.credential-editor__mark {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 10px;
  color: var(--accent);
  background: var(--accent-soft);
}

.credential-editor__mark :deep(svg) {
  stroke-width: 1.8;
}

.credential-editor h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.credential-editor__header p {
  max-width: 52ch;
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.credential-editor__form {
  display: grid;
  gap: 14px;
}

.credential-editor__identity {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.credential-editor__identity div {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 11px 12px;
}

.credential-editor__identity div + div {
  border-left: 1px solid var(--line);
}

.credential-editor__identity span {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.credential-editor__identity strong {
  overflow: hidden;
  color: var(--text-strong);
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credential-editor__key {
  min-height: 128px !important;
  font-family: var(--font-mono);
  line-height: 1.45;
}

.credential-editor__boundary {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.credential-editor__boundary svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--accent);
}

.credential-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

@media (max-width: 520px) {
  .credential-editor__identity {
    grid-template-columns: 1fr;
  }

  .credential-editor__identity div + div {
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .credential-editor__actions {
    flex-direction: column-reverse;
  }

  .credential-editor__actions :deep(.base-button) {
    width: 100%;
  }
}
</style>
