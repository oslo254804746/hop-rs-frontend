<script setup lang="ts">
/* global HTMLButtonElement, HTMLDialogElement, HTMLElement, Event, MouseEvent, document */

import { TriangleAlert, X } from '@lucide/vue'
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

import BaseButton from './BaseButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'primary' | 'danger'
    busy?: boolean
    closeOnBackdrop?: boolean
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    tone: 'danger',
    busy: false,
    closeOnBackdrop: true,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: [reason: 'button' | 'escape' | 'backdrop']
  closed: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const cancelButton = ref<InstanceType<typeof BaseButton> | null>(null)
const previousFocus = ref<HTMLElement | null>(null)
const uid = useId()
const titleId = `confirm-title-${uid}`
const descriptionId = `confirm-description-${uid}`

function restoreFocus() {
  previousFocus.value?.focus({ preventScroll: true })
  previousFocus.value = null
}

async function showDialog() {
  const element = dialog.value
  if (!element || element.open) return

  previousFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (typeof element.showModal === 'function') element.showModal()
  else element.setAttribute('open', '')

  await nextTick()
  const buttonElement = cancelButton.value?.$el
  if (buttonElement instanceof HTMLButtonElement) buttonElement.focus({ preventScroll: true })
}

function hideDialog() {
  const element = dialog.value
  if (!element || (!element.open && !element.hasAttribute('open'))) return

  if (typeof element.close === 'function') element.close()
  else {
    element.removeAttribute('open')
    handleClosed()
  }
}

function requestCancel(reason: 'button' | 'escape' | 'backdrop') {
  if (props.busy) return
  emit('cancel', reason)
  emit('update:open', false)
}

function handleNativeCancel(event: Event) {
  event.preventDefault()
  requestCancel('escape')
}

function handleBackdrop(event: MouseEvent) {
  if (props.closeOnBackdrop && event.target === dialog.value) requestCancel('backdrop')
}

function handleClosed() {
  if (props.open) emit('update:open', false)
  emit('closed')
  restoreFocus()
}

watch(
  () => props.open,
  async (isOpen) => {
    await nextTick()
    if (isOpen) await showDialog()
    else hideDialog()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  const element = dialog.value
  if (element?.open && typeof element.close === 'function') element.close()
  restoreFocus()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="confirm-dialog"
    :aria-labelledby="titleId"
    :aria-describedby="props.description ? descriptionId : undefined"
    :aria-busy="props.busy || undefined"
    @cancel="handleNativeCancel"
    @click="handleBackdrop"
    @close="handleClosed"
  >
    <div class="confirm-dialog__surface">
      <header class="confirm-dialog__header">
        <div
          class="confirm-dialog__mark"
          :class="`confirm-dialog__mark--${props.tone}`"
          aria-hidden="true"
        >
          <TriangleAlert :size="19" />
        </div>
        <div class="confirm-dialog__heading">
          <h2 :id="titleId">
            {{ props.title }}
          </h2>
          <p
            v-if="props.description"
            :id="descriptionId"
          >
            {{ props.description }}
          </p>
        </div>
        <button
          class="confirm-dialog__close"
          type="button"
          :disabled="props.busy"
          :aria-label="props.cancelLabel"
          @click="requestCancel('button')"
        >
          <X
            :size="18"
            aria-hidden="true"
          />
        </button>
      </header>

      <div
        v-if="$slots.default"
        class="confirm-dialog__content"
      >
        <slot />
      </div>

      <footer class="confirm-dialog__actions">
        <BaseButton
          ref="cancelButton"
          variant="secondary"
          :disabled="props.busy"
          @click="requestCancel('button')"
        >
          {{ props.cancelLabel }}
        </BaseButton>
        <BaseButton
          :variant="props.tone"
          :loading="props.busy"
          @click="emit('confirm')"
        >
          {{ props.confirmLabel }}
        </BaseButton>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.confirm-dialog {
  width: min(calc(100vw - 2rem), 30rem);
  max-width: none;
  max-height: min(calc(100dvh - 2rem), 42rem);
  padding: 0;
  border: 0;
  border-radius: 12px;
  color: var(--text, #c2ccd6);
  background: transparent;
  overflow: visible;
}

.confirm-dialog::backdrop {
  background: color-mix(in srgb, var(--surface-canvas, #0d141d) 76%, transparent);
  backdrop-filter: blur(3px);
}

.confirm-dialog__surface {
  overflow: hidden;
  border: 1px solid var(--line, #2a394b);
  border-radius: 12px;
  background: var(--surface-panel, #172231);
  box-shadow: 0 22px 52px rgb(0 0 0 / 0.32);
}

.confirm-dialog__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.75rem;
  padding: 1.25rem;
}

.confirm-dialog__mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 8px;
  color: var(--accent, #53c7a2);
  background: color-mix(in srgb, var(--accent, #53c7a2) 13%, transparent);
}

.confirm-dialog__mark--danger {
  color: var(--danger, #f26464);
  background: color-mix(in srgb, var(--danger, #f26464) 13%, transparent);
}

.confirm-dialog__mark :deep(svg) {
  stroke-width: 1.9;
}

.confirm-dialog__heading h2 {
  margin: 0;
  color: var(--text-strong, #edf3f7);
  font-size: 1rem;
  font-weight: 720;
  letter-spacing: -0.015em;
  line-height: 1.35;
}

.confirm-dialog__heading p {
  margin: 0.375rem 0 0;
  color: var(--text-muted, #8795a5);
  font-size: 0.875rem;
  line-height: 1.5;
}

.confirm-dialog__close {
  display: grid;
  width: 44px;
  height: 44px;
  margin: -0.625rem -0.625rem 0 0;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: var(--text-muted, #8795a5);
  background: transparent;
  cursor: pointer;
}

.confirm-dialog__close:hover:not(:disabled) {
  color: var(--text-strong, #edf3f7);
  background: var(--surface-raised, #1c2939);
}

.confirm-dialog__close:focus-visible {
  outline: 2px solid var(--focus-ring, var(--info, #71b7f4));
  outline-offset: -2px;
}

.confirm-dialog__close:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.confirm-dialog__content {
  padding: 0 1.25rem 1.25rem;
}

.confirm-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--line, #2a394b);
  background: color-mix(in srgb, var(--surface-raised, #1c2939) 42%, var(--surface-panel, #172231));
}

@media (max-width: 520px) {
  .confirm-dialog {
    width: min(calc(100vw - 1rem), 30rem);
  }

  .confirm-dialog__actions {
    flex-direction: column-reverse;
  }

  .confirm-dialog__actions :deep(.base-button) {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .confirm-dialog::backdrop {
    backdrop-filter: none;
  }
}
</style>
