<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import XIcon from '@icons/x.vue'
import CheckIcon from '@icons/check.vue'
import RefreshIcon from '@icons/refresh-cw.vue'
import MobileReaderAvatar from './MobileReaderAvatar.vue'
import type { MobileReader } from '../types'

const props = withDefaults(defineProps<{
  open: boolean
  readers: MobileReader[]
  selectedId: string
  loading?: boolean
  error?: string
  unavailableMessage?: string
  english?: boolean
}>(), { loading: false, error: '', unavailableMessage: '', english: false })
const emit = defineEmits<{ select: [id: string]; close: []; retry: [] }>()
const dialog = ref<HTMLElement | null>(null)
const headingId = `mrp-heading-${useId()}`
const descriptionId = `mrp-description-${useId()}`
const viewportStyle = ref<Record<string, string>>({})
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
let listening = false
let focusSequence = 0

function updateViewport() {
  const viewport = window.visualViewport
  viewportStyle.value = viewport
    ? { '--mrp-viewport-height': `${viewport.height}px`, '--mrp-offset-top': `${viewport.offsetTop}px` }
    : {}
}

function focusables() {
  return Array.from(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])
    .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true')
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const elements = focusables()
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (!first) { event.preventDefault(); dialog.value?.focus({ preventScroll: true }); return }
  if (!dialog.value?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first)?.focus({ preventScroll: true })
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus({ preventScroll: true })
  }
}

function stopListening(restoreFocus: boolean) {
  if (!listening) return
  listening = false
  document.removeEventListener('keydown', handleKeydown, true)
  window.visualViewport?.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('scroll', updateViewport)
  document.body.style.overflow = previousOverflow
  if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  previousFocus = null
}

watch(() => props.open, async open => {
  const sequence = ++focusSequence
  if (!open) { stopListening(true); return }
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  listening = true
  updateViewport()
  document.addEventListener('keydown', handleKeydown, true)
  window.visualViewport?.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('scroll', updateViewport)
  await nextTick()
  if (sequence === focusSequence && props.open) dialog.value?.focus({ preventScroll: true })
}, { immediate: true })

onBeforeUnmount(() => { focusSequence++; stopListening(true) })
</script>

<template>
  <div v-if="open" class="mrp-backdrop" :style="viewportStyle" @click.self="emit('close')">
    <section ref="dialog" class="mrp-dialog" role="dialog" aria-modal="true" :aria-labelledby="headingId" :aria-describedby="descriptionId" tabindex="-1">
      <header class="mrp-heading">
        <div>
          <h2 :id="headingId">{{ english ? 'Choose your reader' : '选择本次塔罗师' }}</h2>
          <p :id="descriptionId">{{ english ? 'Your question and cards stay with you when you change readers.' : '更换塔罗师，保留你的问题和已选牌面。' }}</p>
        </div>
        <button class="mrp-close" type="button" :aria-label="english ? 'Close reader selection' : '关闭塔罗师选择'" @click="emit('close')"><XIcon :size="22" aria-hidden="true" /></button>
      </header>

      <div class="mrp-body" :aria-busy="loading">
        <p v-if="unavailableMessage" class="mrp-notice" role="status">{{ unavailableMessage }}</p>
        <div v-if="error" class="mrp-state mrp-error" role="alert">
          <p>{{ error }}</p>
          <button type="button" class="mrp-retry" :disabled="loading" @click="emit('retry')"><RefreshIcon :size="17" aria-hidden="true" />{{ english ? 'Try again' : '重新加载' }}</button>
        </div>
        <div v-if="loading" class="mrp-state mrp-loading" role="status"><RefreshIcon :size="20" class="mrp-spin" aria-hidden="true" /><p>{{ english ? 'Loading available readers…' : '正在加载可选塔罗师…' }}</p></div>
        <div v-if="readers.length" class="mrp-list" :aria-label="english ? 'Available readers' : '可选塔罗师'">
          <button v-for="reader in readers" :key="reader.id" type="button" class="mrp-reader" :aria-pressed="reader.id === selectedId" :disabled="loading" @click="emit('select', reader.id)">
            <MobileReaderAvatar :reader="reader" :size="52" />
            <span class="mrp-reader-copy">
              <span class="mrp-reader-top"><strong class="mrp-reader-name">{{ reader.name }}</strong><span v-if="reader.id === selectedId" class="mrp-selected"><CheckIcon :size="14" aria-hidden="true" />{{ english ? 'Selected' : '当前选择' }}</span></span>
              <span v-if="reader.desc" class="mrp-reader-description">{{ reader.desc }}</span>
            </span>
          </button>
        </div>
        <div v-else-if="!loading && !error" class="mrp-state mrp-empty" role="status"><p>{{ english ? 'No readers are available right now.' : '暂时没有可选塔罗师。' }}</p><button type="button" class="mrp-retry" @click="emit('retry')"><RefreshIcon :size="17" aria-hidden="true" />{{ english ? 'Reload readers' : '重新加载' }}</button></div>
      </div>
      <p class="mrp-footer">{{ english ? 'Saved readings continue with their original reader.' : '历史记录中的追问，继续由原塔罗师解读。' }}</p>
    </section>
  </div>
</template>
