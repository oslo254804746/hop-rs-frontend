<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'md' | 'sm'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    loadingLabel?: string
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    loadingLabel: 'Working…',
  },
)
</script>

<template>
  <button
    class="base-button"
    :class="[`base-button--${props.variant}`, `base-button--${props.size}`]"
    :type="props.type"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading || undefined"
    :data-loading="props.loading || undefined"
  >
    <LoaderCircle
      v-if="props.loading"
      class="base-button__spinner"
      :size="16"
      aria-hidden="true"
    />
    <span
      v-else-if="$slots.leading"
      class="base-button__icon"
      aria-hidden="true"
    >
      <slot name="leading" />
    </span>
    <span class="base-button__label">
      <span
        v-if="props.loading"
        class="sr-only"
      >{{ props.loadingLabel }}</span>
      <slot />
    </span>
    <span
      v-if="!props.loading && $slots.trailing"
      class="base-button__icon"
      aria-hidden="true"
    >
      <slot name="trailing" />
    </span>
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid transparent;
  border-radius: var(--radius-control, 8px);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.005em;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    transform 120ms ease;
}

.base-button--sm {
  min-height: 32px;
  gap: 0.375rem;
  padding: 0.375rem 0.65rem;
  font-size: 12px;
}

.base-button:focus-visible {
  outline: 2px solid var(--focus, #5ca8ea);
  outline-offset: 2px;
}

.base-button:not(:disabled):active {
  transform: translateY(1px);
}

.base-button:disabled {
  cursor: not-allowed;
  opacity: 0.54;
}

.base-button--primary {
  color: var(--button-accent-foreground, #051810);
  background: var(--accent, #2ec492);
  border-color: color-mix(in srgb, var(--accent, #2ec492) 86%, black);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.base-button--primary:not(:disabled):hover {
  background: color-mix(in srgb, var(--accent, #2ec492) 90%, white);
  border-color: color-mix(in srgb, var(--accent, #2ec492) 90%, white);
}

.base-button--secondary {
  color: var(--text-strong, #f2f5f9);
  background: var(--surface-raised, #1a1f28);
  border-color: var(--line-strong, #323c4c);
  box-shadow: var(--panel-highlight);
}

.base-button--secondary:not(:disabled):hover {
  background: var(--surface-hover, #1e2430);
  border-color: color-mix(in srgb, var(--line-strong, #323c4c) 76%, var(--text, #c5cdd8));
}

.base-button--quiet {
  color: var(--text, #c5cdd8);
  background: transparent;
  border-color: transparent;
}

.base-button--quiet:not(:disabled):hover {
  color: var(--text-strong, #f2f5f9);
  background: var(--surface-hover, #1e2430);
}

.base-button--danger {
  color: var(--button-danger-foreground, #1b0608);
  background: var(--danger, #eb5e66);
  border-color: var(--danger, #eb5e66);
}

.base-button--danger:not(:disabled):hover {
  background: color-mix(in srgb, var(--danger, #eb5e66) 88%, white);
  border-color: color-mix(in srgb, var(--danger, #eb5e66) 88%, white);
}

.base-button__icon,
.base-button__spinner {
  display: inline-flex;
  flex: 0 0 auto;
}

.base-button__icon :deep(svg) {
  width: 15px;
  height: 15px;
  stroke-width: 1.85;
}

.base-button__spinner {
  animation: button-spin 850ms linear infinite;
}

.base-button__label {
  min-width: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .base-button {
    min-height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-button {
    transition: none;
  }

  .base-button__spinner {
    animation-duration: 1.8s;
  }
}
</style>
