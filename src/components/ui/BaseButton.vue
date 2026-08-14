<script setup lang="ts">
import { LoaderCircle } from '@lucide/vue'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    type?: 'button' | 'submit' | 'reset'
    loading?: boolean
    disabled?: boolean
    loadingLabel?: string
  }>(),
  {
    variant: 'secondary',
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
    :class="`base-button--${props.variant}`"
    :type="props.type"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading || undefined"
    :data-loading="props.loading || undefined"
  >
    <LoaderCircle
      v-if="props.loading"
      class="base-button__spinner"
      :size="17"
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
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.base-button:focus-visible {
  outline: 2px solid var(--focus-ring, var(--info, #71b7f4));
  outline-offset: 2px;
}

.base-button:not(:disabled):active {
  transform: translateY(1px);
}

.base-button:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}

.base-button--primary {
  color: var(--button-accent-foreground, #0d141d);
  background: var(--accent, #53c7a2);
  border-color: var(--accent, #53c7a2);
}

.base-button--primary:not(:disabled):hover {
  background: color-mix(in srgb, var(--accent, #53c7a2) 88%, white);
  border-color: color-mix(in srgb, var(--accent, #53c7a2) 88%, white);
}

.base-button--secondary {
  color: var(--text-strong, #edf3f7);
  background: var(--surface-raised, #1c2939);
  border-color: var(--line, #2a394b);
}

.base-button--secondary:not(:disabled):hover {
  background: color-mix(in srgb, var(--surface-raised, #1c2939) 86%, var(--text-strong, #edf3f7));
  border-color: color-mix(in srgb, var(--line, #2a394b) 72%, var(--text, #c2ccd6));
}

.base-button--quiet {
  color: var(--text, #c2ccd6);
  background: transparent;
  border-color: transparent;
}

.base-button--quiet:not(:disabled):hover {
  color: var(--text-strong, #edf3f7);
  background: color-mix(in srgb, var(--surface-raised, #1c2939) 76%, transparent);
}

.base-button--danger {
  color: var(--button-danger-foreground, #190809);
  background: var(--danger, #f26464);
  border-color: var(--danger, #f26464);
}

.base-button--danger:not(:disabled):hover {
  background: color-mix(in srgb, var(--danger, #f26464) 88%, white);
  border-color: color-mix(in srgb, var(--danger, #f26464) 88%, white);
}

.base-button__icon,
.base-button__spinner {
  display: inline-flex;
  flex: 0 0 auto;
}

.base-button__icon :deep(svg) {
  width: 17px;
  height: 17px;
  stroke-width: 1.8;
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

@media (prefers-reduced-motion: reduce) {
  .base-button {
    transition: none;
  }

  .base-button__spinner {
    animation-duration: 1.8s;
  }
}
</style>
