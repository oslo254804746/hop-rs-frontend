<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox } from '@lucide/vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: Component
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const resolvedIcon = computed(() => props.icon ?? Inbox)
</script>

<template>
  <section
    class="empty-state"
    :class="{ 'empty-state--compact': props.compact }"
  >
    <div
      class="empty-state__icon"
      aria-hidden="true"
    >
      <slot name="icon">
        <component
          :is="resolvedIcon"
          :size="22"
        />
      </slot>
    </div>
    <div class="empty-state__copy">
      <h2>{{ props.title }}</h2>
      <p v-if="props.description">
        {{ props.description }}
      </p>
      <slot />
    </div>
    <div
      v-if="$slots.actions"
      class="empty-state__actions"
    >
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.empty-state {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  width: min(100%, 34rem);
  margin-inline: auto;
  padding: clamp(2.25rem, 7vw, 4.5rem) 1.5rem;
  color: var(--text, #c2ccd6);
  text-align: center;
}

.empty-state--compact {
  padding-block: 1.75rem;
}

.empty-state__icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--line, #2a394b);
  border-radius: 10px;
  color: var(--text-muted, #8795a5);
  background: var(--surface-raised, #1c2939);
}

.empty-state__icon :deep(svg) {
  stroke-width: 1.7;
}

.empty-state__copy h2 {
  margin: 0;
  color: var(--text-strong, #edf3f7);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.empty-state__copy p,
.empty-state__copy :deep(p) {
  max-width: 52ch;
  margin: 0.375rem auto 0;
  color: var(--text-muted, #8795a5);
  font-size: 0.875rem;
  line-height: 1.55;
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
</style>
