<script setup lang="ts">
import type { Component } from 'vue'
import { CircleCheck, CircleHelp, CircleX, Info, TriangleAlert } from '@lucide/vue'
import { computed } from 'vue'

import type { StatusTone } from './StatusBadge.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    tone?: StatusTone
    icon?: Component
  }>(),
  {
    tone: 'neutral',
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
  <section
    class="inline-notice"
    :class="`inline-notice--${props.tone}`"
    :role="props.tone === 'danger' ? 'alert' : 'status'"
  >
    <component
      :is="resolvedIcon"
      class="inline-notice__icon"
      :size="18"
      aria-hidden="true"
    />
    <div class="inline-notice__body">
      <p
        v-if="props.title"
        class="inline-notice__title"
      >
        {{ props.title }}
      </p>
      <div class="inline-notice__message">
        <slot />
      </div>
      <div
        v-if="$slots.actions"
        class="inline-notice__actions"
      >
        <slot name="actions" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.inline-notice {
  --notice-color: var(--text-muted, #8795a5);

  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid color-mix(in srgb, var(--notice-color) 30%, var(--line, #2a394b));
  border-radius: 10px;
  color: var(--text, #c2ccd6);
  background: color-mix(in srgb, var(--notice-color) 8%, var(--surface-panel, #172231));
  font-size: 0.875rem;
  line-height: 1.45;
}

.inline-notice--success {
  --notice-color: var(--success, var(--accent, #53c7a2));
}

.inline-notice--warning {
  --notice-color: var(--warning, #f2b84b);
}

.inline-notice--danger {
  --notice-color: var(--danger, #f26464);
}

.inline-notice--info {
  --notice-color: var(--info, #71b7f4);
}

.inline-notice__icon {
  flex: 0 0 auto;
  margin-top: 0.125rem;
  color: var(--notice-color);
  stroke-width: 2;
}

.inline-notice__body {
  min-width: 0;
}

.inline-notice__title {
  margin: 0 0 0.1875rem;
  color: var(--text-strong, #edf3f7);
  font-weight: 700;
}

.inline-notice__message :deep(p) {
  margin: 0;
}

.inline-notice__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>
