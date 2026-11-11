<script setup lang="ts">
import type { Component } from 'vue'
import { CircleCheck, CircleHelp, CircleX, Info, TriangleAlert } from '@lucide/vue'
import { computed } from 'vue'

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const props = withDefaults(
  defineProps<{
    label: string
    tone?: StatusTone
    icon?: Component
    live?: boolean
  }>(),
  {
    tone: 'neutral',
    live: false,
  },
)

const toneIcons: Record<StatusTone, Component> = {
  neutral: CircleHelp,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
  info: Info,
}

const resolvedIcon = computed(() => props.icon ?? toneIcons[props.tone])
</script>

<template>
  <span
    class="status-badge"
    :class="`status-badge--${props.tone}`"
    :role="props.live ? 'status' : undefined"
    :aria-live="props.live ? 'polite' : undefined"
  >
    <component
      :is="resolvedIcon"
      class="status-badge__icon"
      :size="13"
      aria-hidden="true"
    />
    <span>{{ props.label }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  --badge-color: var(--text-muted, #7f8b9b);

  display: inline-flex;
  min-height: 24px;
  max-width: 100%;
  align-items: center;
  gap: 0.32rem;
  padding: 0.15rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--badge-color) 28%, var(--line, #232a35));
  border-radius: 6px;
  color: color-mix(in srgb, var(--badge-color) 86%, var(--text-strong, #f2f5f9));
  background: color-mix(in srgb, var(--badge-color) 11%, transparent);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.15;
  white-space: nowrap;
}

.status-badge--success {
  --badge-color: var(--success, var(--accent, #2ec492));
}

.status-badge--warning {
  --badge-color: var(--warning, #e5a93b);
}

.status-badge--danger {
  --badge-color: var(--danger, #eb5e66);
}

.status-badge--info {
  --badge-color: var(--info, #5ca8ea);
}

.status-badge__icon {
  flex: 0 0 auto;
  stroke-width: 2;
}
</style>
