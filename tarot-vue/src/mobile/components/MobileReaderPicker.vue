<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import XIcon from '@icons/x.vue'
import CheckIcon from '@icons/check.vue'
import RefreshIcon from '@icons/refresh-cw.vue'
import MobileReaderAvatar from './MobileReaderAvatar.vue'
import type { MobileReader } from '../types'
import { getMobileReaderGuide, mobileReaderGuideCopy } from '../mobileReaderGuide'

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
const sampleId = `mrp-sample-${useId()}`
const expandedReaderId = ref<string | null>(null)
const guideCopy = computed(() => mobileReaderGuideCopy(props.english))
const readerChoices = computed(() => props.readers.map(reader => ({ reader, guide: getMobileReaderGuide(reader, props.english) })))
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
  if (!open) { expandedReaderId.value = null; stopListening(true); return }
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
        <div class="mrp-ai-note"><strong>{{ guideCopy.aiIdentity }}</strong><p>{{ guideCopy.guideNote }}</p></div>
        <p v-if="unavailableMessage" class="mrp-notice" role="status">{{ unavailableMessage }}</p>
        <div v-if="error" class="mrp-state mrp-error" role="alert">
          <p>{{ error }}</p>
          <button type="button" class="mrp-retry" :disabled="loading" @click="emit('retry')"><RefreshIcon :size="17" aria-hidden="true" />{{ english ? 'Try again' : '重新加载' }}</button>
        </div>
        <div v-if="loading" class="mrp-state mrp-loading" role="status"><RefreshIcon :size="20" class="mrp-spin" aria-hidden="true" /><p>{{ english ? 'Loading available readers…' : '正在加载可选塔罗师…' }}</p></div>
        <div v-if="readers.length" class="mrp-list" :aria-label="english ? 'Available readers' : '可选塔罗师'">
          <article v-for="({ reader, guide }, index) in readerChoices" :key="reader.id" class="mrp-reader-card" :class="{ 'mrp-reader-card-selected': reader.id === selectedId }">
            <button type="button" class="mrp-reader" :aria-label="`${english ? 'Select' : '选择'} ${reader.name}`" :aria-describedby="`${sampleId}-guide-${index}`" :aria-pressed="reader.id === selectedId" :disabled="loading" @click="emit('select', reader.id)">
              <MobileReaderAvatar :reader="reader" :size="52" />
              <span class="mrp-reader-copy">
                <span class="mrp-reader-top"><strong class="mrp-reader-name">{{ reader.name }}</strong><span v-if="reader.id === selectedId" class="mrp-selected"><CheckIcon :size="14" aria-hidden="true" />{{ english ? 'Selected' : '当前选择' }}</span></span>
                <span :id="`${sampleId}-guide-${index}`" class="mrp-reader-guide">
                  <template v-if="guide.kind === 'reviewed'">
                    <span class="mrp-guide-line"><span class="mrp-guide-label">{{ guideCopy.focus }}</span>{{ guide.focus }}</span>
                    <span class="mrp-guide-line"><span class="mrp-guide-label">{{ guideCopy.voice }}</span>{{ guide.voice }}</span>
                  </template>
                  <span v-else class="mrp-reader-description">{{ guide.intro || guideCopy.noIntro }}</span>
                </span>
              </span>
            </button>
            <template v-if="guide.kind === 'reviewed'">
              <button type="button" class="mrp-example-toggle" :disabled="loading" :aria-expanded="expandedReaderId === reader.id" :aria-controls="`${sampleId}-${index}`" :aria-label="`${expandedReaderId === reader.id ? guideCopy.collapse : guideCopy.expand} · ${reader.name}`" @click="expandedReaderId = expandedReaderId === reader.id ? null : reader.id">
                <span>{{ expandedReaderId === reader.id ? guideCopy.collapse : guideCopy.expand }}</span><span aria-hidden="true">{{ expandedReaderId === reader.id ? '−' : '+' }}</span>
              </button>
              <div v-if="expandedReaderId === reader.id" :id="`${sampleId}-${index}`" class="mrp-example" role="region" :aria-label="`${reader.name} · ${guideCopy.sampleLabel}`">
                <strong class="mrp-example-label">{{ guideCopy.sampleLabel }}</strong>
                <p class="mrp-example-note">{{ guideCopy.sampleNote }}</p>
                <p class="mrp-example-prompt">{{ guideCopy.sampleQuestion }}<br />{{ guideCopy.sampleCard }}</p>
                <blockquote>{{ guide.example }}</blockquote>
              </div>
            </template>
          </article>
        </div>
        <div v-else-if="!loading && !error" class="mrp-state mrp-empty" role="status"><p>{{ english ? 'No readers are available right now.' : '暂时没有可选塔罗师。' }}</p><button type="button" class="mrp-retry" @click="emit('retry')"><RefreshIcon :size="17" aria-hidden="true" />{{ english ? 'Reload readers' : '重新加载' }}</button></div>
      </div>
      <p class="mrp-footer">{{ english ? 'Saved readings continue with their original reader.' : '历史记录中的追问，继续由原塔罗师解读。' }}</p>
    </section>
  </div>
</template>

<style scoped>
.mrp-ai-note { margin:0 0 14px; padding:12px 14px; border:1px solid var(--m-line); border-radius:14px; background:var(--m-accent-soft); overflow-wrap:anywhere; }
.mrp-ai-note strong { color:var(--m-accent); font-size:12px; line-height:1.6; }
.mrp-ai-note p { margin:4px 0 0; color:var(--m-muted); font-size:12px; line-height:1.7; }
.mrp-reader-card { min-width:0; border:1px solid var(--m-line); border-radius:19px; background:var(--m-card-surface); overflow:hidden; }
.mrp-reader-card-selected { border-color:var(--m-accent); background:var(--m-accent-soft); }
.mrp-reader-card .mrp-reader { border:0; border-radius:18px; background:transparent; }
.mrp-reader-card .mrp-reader[aria-pressed=true] { background:transparent; }
.mrp-reader-card .mrp-reader:focus-visible { outline-offset:-4px; }
.mrp-reader-guide { display:grid; gap:5px; min-width:0; }
.mrp-guide-line { display:block; color:var(--m-text); font-size:12px; line-height:1.7; overflow-wrap:anywhere; }
.mrp-guide-label { margin-right:7px; color:var(--m-muted); }
.mrp-example-toggle { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:44px; width:100%; padding:10px 15px; border:0; border-top:1px solid var(--m-line); background:transparent; color:var(--m-accent); font:inherit; font-size:12px; text-align:left; overflow-wrap:anywhere; }
.mrp-example-toggle>span:last-child { flex:none; font-size:18px; line-height:1; }
.mrp-example-toggle:focus-visible { outline-offset:-4px; }
.mrp-example { margin:0 15px 15px; padding:13px; border:1px solid var(--m-line); border-radius:12px; background:var(--m-panel); overflow-wrap:anywhere; }
.mrp-example-label { display:block; color:var(--m-accent); font-size:12px; line-height:1.7; }
.mrp-example-note { margin:4px 0 12px; color:var(--m-muted); font-size:11px; line-height:1.7; }
.mrp-example-prompt { margin:0; color:var(--m-muted); font-size:12px; line-height:1.8; }
.mrp-example blockquote { margin:12px 0 0; padding:0 0 0 11px; border-left:2px solid var(--m-accent); color:var(--m-text); font-size:13px; line-height:1.9; }
@media(max-width:360px) { .mrp-reader-card .mrp-reader { padding:13px 12px; } .mrp-example-toggle { padding-inline:12px; } .mrp-example { margin-inline:12px; padding:11px; } }
</style>
