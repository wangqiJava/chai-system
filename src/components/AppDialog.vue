<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(defineProps<{ modelValue: boolean; title: string; variant?: 'modal' | 'drawer' }>(), { variant: 'modal' })
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const titleId = `dialog-${useId()}`
const panel = ref<HTMLElement | null>(null)
let opener: HTMLElement | null = null
let background: HTMLElement | null = null
let previousInert = false
let previousOverflow = ''
let locked = false
let generation = 0

function focusable() {
  return Array.from(panel.value?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]') || []).filter(element =>
    element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length && !element.closest('[hidden], [inert]'),
  )
}

function focusFirst() {
  const field = panel.value?.querySelector<HTMLElement>('[data-dialog-autofocus]')
  ;(field || focusable()[0] || panel.value)?.focus()
}

function close() { emit('update:modelValue', false) }

function onKey(event: KeyboardEvent) {
  if (!locked) return
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
  if (event.key !== 'Tab') return
  const elements = focusable()
  const first = elements[0], last = elements[elements.length - 1]
  if (!first) { event.preventDefault(); panel.value?.focus(); return }
  if (!panel.value?.contains(document.activeElement) || document.activeElement === panel.value) {
    event.preventDefault(); (event.shiftKey ? last : first).focus()
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus()
  }
}

function onFocus(event: FocusEvent) {
  if (locked && event.target instanceof Node && !panel.value?.contains(event.target)) focusFirst()
}

function unlock(restoreFocus = true) {
  if (!locked) return
  locked = false
  document.removeEventListener('keydown', onKey, true)
  document.removeEventListener('focusin', onFocus)
  document.body.style.overflow = previousOverflow
  if (background) background.inert = previousInert
  const previous = opener
  if (restoreFocus) void nextTick(() => {
    if (props.modelValue) return
    const target = previous?.isConnected ? previous : previous?.id ? document.getElementById(previous.id) : null
    if (target instanceof HTMLElement && target.getClientRects().length && !target.closest('[inert]')) target.focus()
  })
}

watch(() => props.modelValue, async (open) => {
  const current = ++generation
  if (!open) { unlock(); return }
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  if (current !== generation || !props.modelValue || !panel.value) return
  previousOverflow = document.body.style.overflow
  background = document.querySelector<HTMLElement>('.app-layout')
  previousInert = background?.inert || false
  if (background) background.inert = true
  document.body.style.overflow = 'hidden'
  locked = true
  document.addEventListener('keydown', onKey, true)
  document.addEventListener('focusin', onFocus)
  focusFirst()
}, { immediate: true, flush: 'post' })

onBeforeUnmount(() => { generation++; unlock(false) })
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="dialog-backdrop" :class="{ 'dialog-drawer': variant === 'drawer' }" @click.self="close">
      <section ref="panel" class="app-dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
        <header class="app-dialog-head"><h2 :id="titleId">{{ title }}</h2><button class="icon-btn" type="button" aria-label="关闭" @click="close"><AppIcon name="i-close" /></button></header>
        <div class="app-dialog-body"><slot /></div>
        <footer v-if="$slots.footer" class="app-dialog-foot"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>
