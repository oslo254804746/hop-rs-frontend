<script setup lang="ts">
import { computed, useId, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    controlId?: string
    hint?: string
    error?: string
    required?: boolean
  }>(),
  {
    required: false,
  },
)

const slots = useSlots()
const generatedId = useId()
const resolvedId = computed(() => props.controlId ?? `field-${generatedId}`)
const hintId = computed(() => `${resolvedId.value}-hint`)
const errorId = computed(() => `${resolvedId.value}-error`)
const hasHint = computed(() => Boolean(props.hint || slots.hint))
const describedBy = computed(() => {
  const ids: string[] = []
  if (hasHint.value) ids.push(hintId.value)
  if (props.error) ids.push(errorId.value)
  return ids.length > 0 ? ids.join(' ') : undefined
})
const controlProps = computed(() => ({
  id: resolvedId.value,
  'aria-describedby': describedBy.value,
  'aria-invalid': props.error ? ('true' as const) : undefined,
  'aria-required': props.required ? ('true' as const) : undefined,
}))
</script>

<template>
  <div
    class="form-field"
    :class="{ 'form-field--invalid': Boolean(props.error) }"
  >
    <label
      class="form-field__label"
      :for="resolvedId"
    >
      {{ props.label }}
      <span
        v-if="props.required"
        class="form-field__required"
        aria-hidden="true"
      >*</span>
      <span
        v-if="props.required"
        class="sr-only"
      >Required</span>
    </label>
    <slot
      :id="resolvedId"
      :described-by="describedBy"
      :invalid="Boolean(props.error)"
      :control-props="controlProps"
    />
    <p
      v-if="hasHint"
      :id="hintId"
      class="form-field__hint"
    >
      <slot name="hint">
        {{ props.hint }}
      </slot>
    </p>
    <p
      v-if="props.error"
      :id="errorId"
      class="form-field__error"
      role="alert"
    >
      {{ props.error }}
    </p>
  </div>
</template>

<style scoped>
.form-field {
  display: grid;
  gap: 0.4375rem;
}

.form-field__label {
  width: fit-content;
  color: var(--text-strong, #edf3f7);
  font-size: 0.8125rem;
  font-weight: 650;
  line-height: 1.25;
}

.form-field__required,
.form-field__error {
  color: var(--danger, #f26464);
}

.form-field :deep(input),
.form-field :deep(select),
.form-field :deep(textarea) {
  width: 100%;
  min-height: 44px;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--line, #2a394b);
  border-radius: 8px;
  outline: none;
  color: var(--text-strong, #edf3f7);
  background: var(--surface-canvas, #0d141d);
  font: inherit;
  font-size: 0.875rem;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.form-field :deep(textarea) {
  min-height: 7rem;
  resize: vertical;
}

.form-field :deep(input::placeholder),
.form-field :deep(textarea::placeholder) {
  color: var(--text-muted, #8795a5);
  opacity: 1;
}

.form-field :deep(input:hover),
.form-field :deep(select:hover),
.form-field :deep(textarea:hover) {
  border-color: color-mix(in srgb, var(--line, #2a394b) 60%, var(--text-muted, #8795a5));
}

.form-field :deep(input:focus-visible),
.form-field :deep(select:focus-visible),
.form-field :deep(textarea:focus-visible) {
  border-color: var(--focus-ring, var(--info, #71b7f4));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--focus-ring, var(--info, #71b7f4)) 30%, transparent);
}

.form-field--invalid :deep(input),
.form-field--invalid :deep(select),
.form-field--invalid :deep(textarea) {
  border-color: var(--danger, #f26464);
}

.form-field__hint,
.form-field__error {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
}

.form-field__hint {
  color: var(--text-muted, #8795a5);
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

@media (prefers-reduced-motion: reduce) {
  .form-field :deep(input),
  .form-field :deep(select),
  .form-field :deep(textarea) {
    transition: none;
  }
}
</style>
