<script setup lang="ts">
/* global HTMLDialogElement */

import { Activity, Bell, Globe, Pencil, Plus, Send, Smartphone, Trash2, X } from '@lucide/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { BaseButton, ConfirmDialog, EmptyState, InlineNotice, StatusBadge } from '@/components/ui'
import type {
  NotificationChannel,
  NotificationChannelKind,
  NotificationChannelWriteInput,
} from '@/domain'
import { useI18n } from '@/i18n'
import {
  useCreateNotificationChannelMutation,
  useDeleteNotificationChannelMutation,
  useHopApiRuntime,
  useNotificationChannelsQuery,
  useProbeSettingsQuery,
  useTestNotificationChannelMutation,
  useUpdateNotificationChannelMutation,
  useUpdateProbeSettingsMutation,
} from '@/queries'
import { formatRelativeTime } from '@/utils/format'

const { t } = useI18n()
const runtime = useHopApiRuntime()
const probeSettingsQuery = useProbeSettingsQuery()
const channelsQuery = useNotificationChannelsQuery()
const updatePolicyMutation = useUpdateProbeSettingsMutation()
const createChannelMutation = useCreateNotificationChannelMutation()
const updateChannelMutation = useUpdateNotificationChannelMutation()
const deleteChannelMutation = useDeleteNotificationChannelMutation()
const testChannelMutation = useTestNotificationChannelMutation()

const policyForm = reactive({
  enabled: false,
  intervalSeconds: 180,
  timeoutMs: 5000,
  failureThreshold: 2,
  notifyOnRecovery: true,
})

const policyNotice = ref<{ tone: 'success' | 'danger'; title: string; body?: string | undefined } | null>(null)
const channelNotice = ref<{ tone: 'success' | 'danger'; title: string; body?: string | undefined } | null>(null)

const channelDialog = ref<HTMLDialogElement | null>(null)
const channelEditorOpen = ref(false)
const editingChannel = ref<NotificationChannel | null>(null)
const channelEditorError = ref('')

const channelForm = reactive({
  name: '',
  kind: 'telegram' as NotificationChannelKind,
  enabled: true,
  botToken: '',
  chatId: '',
  apiBaseUrl: '',
  deviceKey: '',
  serverUrl: '',
  url: '',
  secret: '',
})

const deleteDialogOpen = ref(false)
const deletingChannel = ref<NotificationChannel | null>(null)
const testingChannelId = ref<string | null>(null)

const channels = computed(() => channelsQuery.data.value ?? [])

watch(
  () => probeSettingsQuery.data.value,
  (settings) => {
    if (!settings) return
    policyForm.enabled = settings.enabled
    policyForm.intervalSeconds = settings.intervalSeconds
    policyForm.timeoutMs = settings.timeoutMs
    policyForm.failureThreshold = settings.failureThreshold
    policyForm.notifyOnRecovery = settings.notifyOnRecovery
  },
  { immediate: true },
)

watch(channelEditorOpen, async (open) => {
  await nextTick()
  const el = channelDialog.value
  if (!el) return
  if (open && !el.open) {
    if (typeof el.showModal === 'function') el.showModal()
    else el.setAttribute('open', '')
  } else if (!open && (el.open || el.hasAttribute('open'))) {
    if (typeof el.close === 'function') el.close()
    else el.removeAttribute('open')
  }
})

async function savePolicy() {
  policyNotice.value = null
  try {
    await updatePolicyMutation.mutateAsync({
      enabled: policyForm.enabled,
      intervalSeconds: Number(policyForm.intervalSeconds),
      timeoutMs: Number(policyForm.timeoutMs),
      failureThreshold: Number(policyForm.failureThreshold),
      notifyOnRecovery: policyForm.notifyOnRecovery,
    })
    policyNotice.value = {
      tone: 'success',
      title: t('Probe policy saved'),
    }
  } catch (error) {
    policyNotice.value = {
      tone: 'danger',
      title: t('Probe policy could not be saved'),
      body: error instanceof Error ? error.message : undefined,
    }
  }
}

function openCreateChannel() {
  editingChannel.value = null
  Object.assign(channelForm, {
    name: '',
    kind: 'telegram' as NotificationChannelKind,
    enabled: true,
    botToken: '',
    chatId: '',
    apiBaseUrl: '',
    deviceKey: '',
    serverUrl: '',
    url: '',
    secret: '',
  })
  channelEditorError.value = ''
  channelEditorOpen.value = true
}

function openEditChannel(channel: NotificationChannel) {
  editingChannel.value = channel
  Object.assign(channelForm, {
    name: channel.name,
    kind: channel.kind,
    enabled: channel.enabled,
    botToken: '',
    chatId: channel.config.chatId ?? '',
    apiBaseUrl: channel.config.apiBaseUrl ?? '',
    deviceKey: '',
    serverUrl: channel.config.serverUrl ?? '',
    url: channel.config.url ?? '',
    secret: '',
  })
  channelEditorError.value = ''
  channelEditorOpen.value = true
}

function closeChannelEditor() {
  channelEditorOpen.value = false
}

function buildChannelWriteInput(): NotificationChannelWriteInput {
  const name = channelForm.name.trim()
  if (!name) throw new Error(t('Channel name'))

  const isEditing = Boolean(editingChannel.value)
  const sameKind = editingChannel.value?.kind === channelForm.kind

  if (channelForm.kind === 'telegram') {
    const chatId = channelForm.chatId.trim()
    const botToken = channelForm.botToken.trim()
    if (!chatId) throw new Error('Chat ID is required.')
    if (!botToken && !(isEditing && sameKind && editingChannel.value?.config.hasSecret)) {
      throw new Error('Bot Token is required.')
    }
    return {
      name,
      kind: 'telegram',
      enabled: channelForm.enabled,
      config: {
        chatId,
        botToken: botToken || null,
        apiBaseUrl: channelForm.apiBaseUrl.trim() || null,
      },
    }
  }

  if (channelForm.kind === 'bark') {
    const deviceKey = channelForm.deviceKey.trim()
    if (!deviceKey && !(isEditing && sameKind && editingChannel.value?.config.hasSecret)) {
      throw new Error('Bark Device Key is required.')
    }
    return {
      name,
      kind: 'bark',
      enabled: channelForm.enabled,
      config: {
        deviceKey: deviceKey || null,
        serverUrl: channelForm.serverUrl.trim() || null,
      },
    }
  }

  const url = channelForm.url.trim()
  if (!url) throw new Error('Webhook URL is required.')
  return {
    name,
    kind: 'webhook',
    enabled: channelForm.enabled,
    config: {
      url,
      secret: channelForm.secret.trim() || null,
    },
  }
}

async function submitChannel() {
  channelEditorError.value = ''
  channelNotice.value = null
  try {
    const input = buildChannelWriteInput()
    if (editingChannel.value) {
      await updateChannelMutation.mutateAsync({ id: editingChannel.value.id, input })
    } else {
      await createChannelMutation.mutateAsync(input)
    }
    channelEditorOpen.value = false
    channelNotice.value = {
      tone: 'success',
      title: t('Channel saved.'),
    }
  } catch (error) {
    channelEditorError.value =
      error instanceof Error ? error.message : t('Notification action failed')
  }
}

async function runTestChannel(channel: NotificationChannel) {
  channelNotice.value = null
  testingChannelId.value = channel.id
  try {
    await testChannelMutation.mutateAsync(channel.id)
    channelNotice.value = {
      tone: 'success',
      title: t('Test notification delivered to {name}.', { name: channel.name }),
    }
  } catch (error) {
    channelNotice.value = {
      tone: 'danger',
      title: t('Notification action failed'),
      body: error instanceof Error ? error.message : undefined,
    }
  } finally {
    testingChannelId.value = null
  }
}

function promptDeleteChannel(channel: NotificationChannel) {
  deletingChannel.value = channel
  deleteDialogOpen.value = true
}

async function confirmDeleteChannel() {
  if (!deletingChannel.value) return
  channelNotice.value = null
  try {
    await deleteChannelMutation.mutateAsync(deletingChannel.value.id)
    deleteDialogOpen.value = false
    deletingChannel.value = null
    channelNotice.value = {
      tone: 'success',
      title: t('Channel deleted.'),
    }
  } catch (error) {
    deleteDialogOpen.value = false
    channelNotice.value = {
      tone: 'danger',
      title: t('Notification action failed'),
      body: error instanceof Error ? error.message : undefined,
    }
  }
}

function channelTargetSummary(channel: NotificationChannel): string {
  if (channel.kind === 'telegram') {
    const base = channel.config.apiBaseUrl ? ` · ${channel.config.apiBaseUrl}` : ''
    return `chat_id:${channel.config.chatId ?? '—'}${base}`
  }
  if (channel.kind === 'bark') {
    return channel.config.serverUrl || 'https://api.day.app'
  }
  return channel.config.url || '—'
}

function channelSecretLabel(channel: NotificationChannel): string {
  if (channel.kind === 'webhook') {
    return t(channel.config.hasSecret ? 'Secret encrypted' : 'No signing secret')
  }
  return t(channel.config.hasSecret ? 'Secret encrypted' : 'Secret incomplete')
}
</script>

<template>
  <section class="alerts-page page-stack">
    <header class="page-intro">
      <div>
        <h1>{{ t('Alerts') }}</h1>
        <p>{{ t('Alerts intro description') }}</p>
      </div>
      <div class="page-intro__actions">
        <BaseButton
          variant="primary"
          :disabled="!runtime.ready.value"
          @click="openCreateChannel"
        >
          <template #leading><Plus /></template>
          {{ t('New channel') }}
        </BaseButton>
      </div>
    </header>

    <div class="alerts-grid">
      <section class="panel policy-panel">
        <header class="panel-heading">
          <div class="panel-heading__lead">
            <span class="panel-icon" aria-hidden="true">
              <Activity :size="18" />
            </span>
            <div>
              <h2>{{ t('Scheduled probing') }}</h2>
              <p>{{ t('Configure periodic zero-agent TCP / SSH banner checks and alert thresholds.') }}</p>
            </div>
          </div>
          <StatusBadge
            :label="t(policyForm.enabled ? 'Enabled' : 'Paused')"
            :tone="policyForm.enabled ? 'success' : 'neutral'"
          />
        </header>

        <form class="policy-form" @submit.prevent="void savePolicy()">
          <InlineNotice
            v-if="policyNotice"
            :tone="policyNotice.tone"
            :title="policyNotice.title"
          >
            <p v-if="policyNotice.body">{{ policyNotice.body }}</p>
          </InlineNotice>

          <label class="toggle-card">
            <input v-model="policyForm.enabled" name="probe-enabled" type="checkbox" />
            <div>
              <strong>{{ t('Enable background probing') }}</strong>
              <small>{{ t('Every {seconds}s', { seconds: policyForm.intervalSeconds }) }}</small>
            </div>
          </label>

          <div class="policy-numbers">
            <label class="policy-field">
              <span>{{ t('Interval (seconds)') }}</span>
              <input
                v-model.number="policyForm.intervalSeconds"
                name="probe-interval-seconds"
                type="number"
                min="30"
                max="86400"
                required
              />
              <small>{{ t('Between 30 and 86400 seconds.') }}</small>
            </label>

            <label class="policy-field">
              <span>{{ t('Timeout (ms)') }}</span>
              <input
                v-model.number="policyForm.timeoutMs"
                name="probe-timeout-ms"
                type="number"
                min="500"
                max="15000"
                required
              />
              <small>{{ t('Between 500 and 15000 ms.') }}</small>
            </label>

            <label class="policy-field policy-field--wide">
              <span>{{ t('Failure threshold') }}</span>
              <input
                v-model.number="policyForm.failureThreshold"
                name="probe-failure-threshold"
                type="number"
                min="1"
                max="10"
                required
              />
              <small>{{ t('Consecutive failures before firing alert (1–10).') }}</small>
            </label>
          </div>

          <label class="toggle-card">
            <input v-model="policyForm.notifyOnRecovery" name="notify-on-recovery" type="checkbox" />
            <div>
              <strong>{{ t('Notify when asset recovers') }}</strong>
            </div>
          </label>

          <footer class="policy-footer">
            <span v-if="probeSettingsQuery.data.value?.updatedAt" class="policy-updated tabular">
              {{ t('Updated') }}: {{ formatRelativeTime(probeSettingsQuery.data.value.updatedAt) }}
            </span>
            <span v-else />
            <BaseButton
              variant="primary"
              type="submit"
              :disabled="!runtime.ready.value"
              :loading="updatePolicyMutation.isPending.value"
              :loading-label="t('Saving…')"
            >
              {{ t('Save policy') }}
            </BaseButton>
          </footer>
        </form>
      </section>

      <section class="panel channels-panel">
        <header class="panel-heading">
          <div class="panel-heading__lead">
            <span class="panel-icon" aria-hidden="true">
              <Bell :size="18" />
            </span>
            <div>
              <h2>{{ t('Notification channels') }}</h2>
              <p>{{ t('Encrypted at rest with MasterKey. Supports Telegram Bot, Bark, and HMAC-signed Webhooks.') }}</p>
            </div>
          </div>
          <StatusBadge :label="String(channels.length)" tone="neutral" />
        </header>

        <div v-if="channelNotice" class="channel-notice-wrap">
          <InlineNotice :tone="channelNotice.tone" :title="channelNotice.title">
            <p v-if="channelNotice.body">{{ channelNotice.body }}</p>
          </InlineNotice>
        </div>

        <div v-if="channels.length > 0" class="channel-list">
          <article v-for="channel in channels" :key="channel.id" class="channel-row">
            <div class="channel-main">
              <span class="channel-kind-icon" aria-hidden="true">
                <Send v-if="channel.kind === 'telegram'" :size="16" />
                <Smartphone v-else-if="channel.kind === 'bark'" :size="16" />
                <Globe v-else :size="16" />
              </span>
              <div class="channel-copy">
                <div class="channel-title">
                  <strong>{{ channel.name }}</strong>
                  <StatusBadge :label="channel.kind.toUpperCase()" tone="info" />
                  <StatusBadge
                    :label="t(channel.enabled ? 'Enabled' : 'Paused')"
                    :tone="channel.enabled ? 'success' : 'neutral'"
                  />
                </div>
                <div class="channel-meta">
                  <span class="mono">{{ channelTargetSummary(channel) }}</span>
                  <span>· {{ channelSecretLabel(channel) }}</span>
                </div>
              </div>
            </div>

            <div class="channel-actions">
              <BaseButton
                size="sm"
                variant="secondary"
                :loading="testingChannelId === channel.id"
                :loading-label="t('Sending…')"
                @click="void runTestChannel(channel)"
              >
                <template #leading><Send /></template>
                {{ t('Send test') }}
              </BaseButton>
              <button
                class="icon-action"
                type="button"
                :aria-label="`${t('Edit channel')} · ${channel.name}`"
                :title="t('Edit channel')"
                @click="openEditChannel(channel)"
              >
                <Pencil :size="15" aria-hidden="true" />
              </button>
              <button
                class="icon-action icon-action--danger"
                type="button"
                :aria-label="`${t('Delete channel')} · ${channel.name}`"
                :title="t('Delete channel')"
                @click="promptDeleteChannel(channel)"
              >
                <Trash2 :size="15" aria-hidden="true" />
              </button>
            </div>
          </article>
        </div>

        <EmptyState
          v-else-if="!channelsQuery.isPending.value"
          :compact="true"
          :title="t('No notification channels configured')"
          :description="t('Add a Telegram Bot, Bark device, or Webhook endpoint to receive instant alerts.')"
        >
          <template #actions>
            <BaseButton variant="primary" @click="openCreateChannel">
              <template #leading><Plus /></template>
              {{ t('New channel') }}
            </BaseButton>
          </template>
        </EmptyState>
      </section>
    </div>

    <dialog
      ref="channelDialog"
      class="channel-editor"
      @close="channelEditorOpen = false"
      @cancel.prevent="closeChannelEditor"
    >
      <form class="editor-form" @submit.prevent="void submitChannel()">
        <header>
          <div>
            <h2>{{ t(editingChannel ? 'Edit channel' : 'New channel') }}</h2>
            <p>{{ t('Encrypted at rest with MasterKey. Supports Telegram Bot, Bark, and HMAC-signed Webhooks.') }}</p>
          </div>
          <button type="button" :aria-label="t('Close editor')" @click="closeChannelEditor">
            <X :size="18" />
          </button>
        </header>

        <InlineNotice v-if="channelEditorError" tone="danger" :title="t('Notification action failed')">
          <p>{{ channelEditorError }}</p>
        </InlineNotice>

        <div class="editor-fields">
          <div class="editor-row">
            <label>
              <span>{{ t('Channel name') }}</span>
              <input v-model="channelForm.name" name="channel-name" autocomplete="off" placeholder="Ops Telegram" required />
            </label>
            <label>
              <span>{{ t('Channel type') }}</span>
              <select v-model="channelForm.kind" name="channel-kind">
                <option value="telegram">Telegram Bot</option>
                <option value="bark">Bark (iOS)</option>
                <option value="webhook">Webhook (HMAC)</option>
              </select>
            </label>
          </div>

          <template v-if="channelForm.kind === 'telegram'">
            <div class="editor-row">
              <label>
                <span>{{ t('Chat ID') }}</span>
                <input v-model="channelForm.chatId" name="telegram-chat-id" class="mono" autocomplete="off" placeholder="-100238901442" />
              </label>
              <label>
                <span>{{ t('Bot Token') }}</span>
                <input v-model="channelForm.botToken" name="telegram-bot-token" type="password" autocomplete="new-password" placeholder="123456:ABC-DEF..." />
              </label>
            </div>
            <label>
              <span>{{ t('Telegram API base URL (optional)') }}</span>
              <input v-model="channelForm.apiBaseUrl" name="telegram-api-base-url" class="mono" autocomplete="off" placeholder="https://api.telegram.org" />
            </label>
          </template>

          <template v-else-if="channelForm.kind === 'bark'">
            <label>
              <span>{{ t('Bark Device Key') }}</span>
              <input v-model="channelForm.deviceKey" name="bark-device-key" type="password" autocomplete="new-password" placeholder="aBcDeFgHiJkLmNoPqRsTuV" />
            </label>
            <label>
              <span>{{ t('Bark Server URL (optional)') }}</span>
              <input v-model="channelForm.serverUrl" name="bark-server-url" class="mono" autocomplete="off" placeholder="https://api.day.app" />
            </label>
          </template>

          <template v-else>
            <label>
              <span>{{ t('Webhook URL') }}</span>
              <input v-model="channelForm.url" name="webhook-url" class="mono" autocomplete="off" placeholder="https://ops.example.com/hooks/hop" />
            </label>
            <label>
              <span>{{ t('HMAC signing secret (optional)') }}</span>
              <input v-model="channelForm.secret" name="webhook-secret" type="password" autocomplete="new-password" />
            </label>
          </template>

          <small v-if="editingChannel" class="secret-preserve-note">
            {{ t('Leave secret blank to keep the existing encrypted value.') }}
          </small>

          <label class="toggle-card">
            <input v-model="channelForm.enabled" name="channel-enabled" type="checkbox" />
            <div>
              <strong>{{ t('Active') }}</strong>
            </div>
          </label>
        </div>

        <footer>
          <BaseButton variant="secondary" @click="closeChannelEditor">{{ t('Cancel') }}</BaseButton>
          <BaseButton
            variant="primary"
            type="submit"
            :loading="createChannelMutation.isPending.value || updateChannelMutation.isPending.value"
          >
            {{ t(editingChannel ? 'Save changes' : 'New channel') }}
          </BaseButton>
        </footer>
      </form>
    </dialog>

    <ConfirmDialog
      v-model:open="deleteDialogOpen"
      :title="t('Delete notification channel?')"
      :description="deletingChannel ? t('{name} will stop receiving down and recovery alerts.', { name: deletingChannel.name }) : ''"
      :confirm-label="t('Delete channel')"
      :busy="deleteChannelMutation.isPending.value"
      @confirm="confirmDeleteChannel"
    />
  </section>
</template>

<style scoped>
.alerts-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.92fr) minmax(0, 1.35fr);
  align-items: start;
  gap: 14px;
}

.policy-panel,
.channels-panel {
  min-width: 0;
  overflow: hidden;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 18px;
  border-bottom: 1px solid var(--line);
}

.panel-heading__lead {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 11px;
}

.panel-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--line));
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.panel-heading h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 15.5px;
  font-weight: 640;
  letter-spacing: -0.02em;
}

.panel-heading p {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 12.5px;
}

.policy-form {
  display: grid;
  gap: 14px;
  padding: 16px 18px 18px;
}

.toggle-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-input);
  cursor: pointer;
}

.toggle-card input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.toggle-card div {
  display: grid;
  gap: 1px;
}

.toggle-card strong {
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
}

.toggle-card small {
  color: var(--text-muted);
  font-size: 11.5px;
}

.policy-numbers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
}

.policy-field {
  display: grid;
  align-content: start;
  gap: 5px;
}

.policy-field--wide {
  grid-column: 1 / -1;
}

.policy-field > span,
.editor-fields label > span {
  color: var(--text-strong);
  font-size: 12px;
  font-weight: 600;
}

.policy-field input,
.editor-fields input,
.editor-fields select {
  width: 100%;
  height: 39px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--surface-input);
  outline: 0;
}

.policy-field input:focus,
.editor-fields input:focus,
.editor-fields select:focus {
  border-color: var(--focus);
}

.policy-field small,
.secret-preserve-note {
  color: var(--text-muted);
  font-size: 11.5px;
}

.policy-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 4px;
}

.policy-updated {
  color: var(--text-muted);
  font-size: 12px;
}

.channel-notice-wrap {
  padding: 12px 18px 0;
}

.channel-list {
  display: grid;
}

.channel-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--line);
}

.channel-row:last-child {
  border-bottom: 0;
}

.channel-main {
  display: grid;
  min-width: 0;
  flex: 1 1 260px;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 11px;
}

.channel-kind-icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--info);
}

.channel-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.channel-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.channel-title strong {
  color: var(--text-strong);
  font-size: 13.5px;
  font-weight: 620;
}

.channel-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.channel-meta .mono {
  overflow-wrap: anywhere;
  color: var(--text);
}

.channel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-action {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface-raised);
  color: var(--text-muted);
  cursor: pointer;
}

.icon-action:hover {
  border-color: var(--line-strong);
  color: var(--text-strong);
}

.icon-action--danger:hover {
  border-color: color-mix(in srgb, var(--danger) 48%, var(--line));
  background: var(--danger-soft);
  color: var(--danger);
}

.channel-editor {
  width: min(580px, calc(100vw - 24px));
  max-height: calc(100dvh - 28px);
  padding: 0;
  border: 1px solid var(--line-strong);
  border-radius: 13px;
  background: var(--surface-panel);
  color: var(--text);
  box-shadow: var(--panel-highlight), var(--shadow-layer);
}

.channel-editor::backdrop {
  background: rgba(5, 9, 14, 0.72);
  backdrop-filter: blur(4px);
}

.editor-form {
  display: grid;
  gap: 15px;
  padding: 20px 22px;
}

.editor-form header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.editor-form h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 17px;
}

.editor-form header p {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 12.5px;
}

.editor-form header > button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.editor-form header > button:hover {
  background: var(--surface-hover);
  color: var(--text-strong);
}

.editor-fields {
  display: grid;
  gap: 11px;
}

.editor-fields label {
  display: grid;
  gap: 5px;
}

.editor-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.editor-form footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 1080px) {
  .alerts-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .policy-numbers,
  .editor-row {
    grid-template-columns: 1fr;
  }

  .editor-form footer {
    display: grid;
    grid-template-columns: 1fr;
  }

  .editor-form footer :deep(.base-button) {
    width: 100%;
  }
}
</style>
