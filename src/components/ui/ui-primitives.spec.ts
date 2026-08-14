// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'

import BaseButton from './BaseButton.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import EmptyState from './EmptyState.vue'
import FormField from './FormField.vue'
import InlineNotice from './InlineNotice.vue'
import StatusBadge from './StatusBadge.vue'

describe('UI primitives', () => {
  it('prevents interaction and announces progress while a button is loading', async () => {
    const wrapper = mount(BaseButton, {
      props: { loading: true, variant: 'primary' },
      slots: { default: 'Save asset' },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('Working…')
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('pairs status color with an icon and readable label', () => {
    const wrapper = mount(StatusBadge, { props: { label: 'Connected', tone: 'success' } })

    expect(wrapper.text()).toBe('Connected')
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.classes()).toContain('status-badge--success')
  })

  it('uses alert semantics for destructive notices', () => {
    const wrapper = mount(InlineNotice, {
      props: { title: 'Revision conflict', tone: 'danger' },
      slots: { default: 'Refresh the diff before applying again.' },
    })

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('Refresh the diff')
  })

  it('renders a compact empty state with an action region', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No assets', description: 'Create a local asset to get started.', compact: true },
      slots: { actions: '<button>Create asset</button>' },
    })

    expect(wrapper.find('h2').text()).toBe('No assets')
    expect(wrapper.classes()).toContain('empty-state--compact')
    expect(wrapper.find('button').text()).toBe('Create asset')
  })

  it('exposes complete accessibility attributes to a form control', () => {
    const wrapper = mount(FormField, {
      props: {
        label: 'Asset name',
        hint: 'Use a stable catalog identifier.',
        error: 'Name is already in use.',
        required: true,
      },
      slots: {
        default: ({ controlProps }: { controlProps: Record<string, unknown> }) => [h('input', controlProps)],
      },
    })

    const input = wrapper.find('input')
    const label = wrapper.find('label')
    expect(input.attributes('id')).toBe(label.attributes('for'))
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain('-hint')
    expect(input.attributes('aria-describedby')).toContain('-error')
  })

  it('supports controlled cancellation of the confirmation dialog', async () => {
    const wrapper = mount(ConfirmDialog, {
      attachTo: document.body,
      props: { open: true, title: 'Remove asset?', description: 'This cannot be undone.' },
    })

    await wrapper.vm.$nextTick()
    expect(wrapper.find('dialog').attributes('open')).toBeDefined()
    await wrapper.find('dialog').trigger('cancel')
    expect(wrapper.emitted('cancel')?.[0]).toEqual(['escape'])
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
    wrapper.unmount()
  })
})
