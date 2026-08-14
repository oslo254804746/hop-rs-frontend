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
      :size="14"
      aria-hidden="true"
    />
    <span>{{ props.label }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  --badge-color: var(--text-muted, #8795a5);

  display: inline-flex;
  min-height: 28px;
  max-width: 100%;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid color-mix(in srgb, var(--badge-color) 34%, transparent);
  border-radius: 999px;
  color: color-mix(in srgb, var(--badge-color) 82%, var(--text-strong, #edf3f7));
  background: color-mix(in srgb, var(--badge-color) 11%, transparent);
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1.15;
}

.status-badge--success {
  --badge-color: var(--success, var(--accent, #53c7a2));
}

.status-badge--warning {
  --badge-color: var(--warning, #f2b84b);
}

.status-badge--danger {
  --badge-color: var(--danger, #f26464);
}

.status-badge--info {
  --badge-color: var(--info, #71b7f4);
}

.status-badge__icon {
  flex: 0 0 auto;
  stroke-width: 2;
}
</style>
