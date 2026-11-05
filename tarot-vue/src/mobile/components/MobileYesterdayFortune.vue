<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import XIcon from '@icons/x.vue'
import HistoryIcon from '@icons/history.vue'
import RefreshIcon from '@icons/refresh-cw.vue'
import type { DailyFortuneResponse } from '../../services/tarotAiReading'
import { findOfflineCard, getOfflineCardImageUrl } from '../data/offlineCards'
import MobileDailyResult from './MobileDailyResult.vue'

const props = withDefaults(defineProps<{
  open: boolean
  busy: boolean
  error: string
  english: boolean
  response: Pick<DailyFortuneResponse, 'businessDate' | 'timeZone' | 'cached' | 'card' | 'result'> | null
  cached?: boolean
}>(), { cached: false })
const emit = defineEmits<{ close: []; retry: [] }>()
const dialog = ref<HTMLElement | null>(null)
const headingId = `myf-heading-${useId()}`
const descriptionId = `myf-description-${useId()}`
const viewportStyle = ref<Record<string, string>>({})
const imageFailed = ref(false)
const card = computed(() => props.response?.card)
const cardData = computed(() => card.value ? findOfflineCard(card.value.id) : undefined)
const cardName = computed(() => props.english ? card.value?.nameEn || cardData.value?.nameEn : card.value?.name || cardData.value?.name)
const cardImage = computed(() => cardData.value ? getOfflineCardImageUrl(cardData.value.nameEn) : '')
const direction = computed(() => props.english ? (card.value?.isReversed ? 'Reversed' : 'Upright') : (card.value?.isReversed ? '逆位' : '正位'))
const errorText = computed(() => props.english ? 'Yesterday’s fortune could not be loaded. Check your connection and try again.' : props.error)
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
let listening = false
let focusSequence = 0

watch(() => props.response?.businessDate, () => { imageFailed.value = false })

function updateViewport() {
  const viewport = window.visualViewport
  viewportStyle.value = viewport
    ? { '--myf-viewport-height': `${viewport.height}px`, '--myf-offset-top': `${viewport.offsetTop}px` }
    : {}
}

function focusables() {
  return Array.from(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') || [])
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
  <div v-if="open" class="myf-backdrop" :style="viewportStyle" @click.self="emit('close')">
    <section ref="dialog" class="myf-dialog" role="dialog" aria-modal="true" :aria-labelledby="headingId" :aria-describedby="descriptionId" tabindex="-1">
      <header class="myf-header">
        <div><p class="myf-eyebrow"><HistoryIcon :size="14" aria-hidden="true" />{{ english ? 'SAVED FORTUNE' : '运势回看' }}</p><h2 :id="headingId">{{ english ? 'Yesterday’s fortune' : '昨日运势' }}</h2><p :id="descriptionId" class="myf-description"><span v-if="response?.businessDate">{{ response.businessDate }} · </span>{{ english ? 'Revisit yesterday’s card and reading.' : '回看昨日抽到的牌与解读。' }}</p></div>
        <button type="button" class="myf-close" :aria-label="english ? 'Close yesterday’s fortune' : '关闭昨日运势'" @click="emit('close')"><XIcon :size="22" aria-hidden="true" /></button>
      </header>

      <div class="myf-body" :aria-busy="busy">
        <p v-if="cached && response?.result" class="myf-cache" role="status">{{ english ? 'Showing the result saved on this device.' : '当前显示本机保存的昨日结果。' }}</p>
        <div v-if="error" class="myf-state myf-error" role="alert"><p>{{ errorText }}</p><button type="button" class="myf-retry" :disabled="busy" @click="emit('retry')"><RefreshIcon :size="16" aria-hidden="true" />{{ english ? 'Try again' : '重新加载' }}</button></div>
        <div v-if="busy && !response?.result" class="myf-state myf-loading" role="status"><RefreshIcon :size="22" class="myf-spin" aria-hidden="true" /><p>{{ english ? 'Loading yesterday’s fortune…' : '正在读取昨日运势…' }}</p></div>
        <template v-if="response?.result">
          <figure v-if="card" class="myf-card">
            <div class="myf-card-art"><img v-if="cardImage && !imageFailed" :src="cardImage" :alt="`${cardName} · ${direction}`" :class="{ 'myf-card-reversed': card.isReversed }" draggable="false" @error="imageFailed = true"><span v-else>{{ english ? 'Card image unavailable' : '牌面图暂不可用' }}</span></div>
            <figcaption><strong>{{ cardName }}</strong><span>{{ direction }}</span></figcaption>
          </figure>
          <MobileDailyResult :key="response.businessDate" :response="response" :busy="false" error="" :english="english" period="yesterday" :show-yesterday="false" :show-header="false" />
        </template>
        <div v-else-if="!busy && !error" class="myf-state myf-empty" role="status"><HistoryIcon :size="28" aria-hidden="true" /><h3>{{ english ? 'No saved fortune for yesterday' : '昨日暂无运势记录' }}</h3><p>{{ english ? 'There is no saved card or reading to revisit for this date.' : '昨日没有已保存的卡牌与解读。' }}</p></div>
      </div>

      <footer class="myf-footer"><button type="button" @click="emit('close')">{{ english ? 'Return to today’s fortune' : '返回今日运势' }}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.myf-backdrop { position:fixed; z-index:70; inset:var(--myf-offset-top,0px) 0 auto; display:flex; align-items:flex-end; justify-content:center; height:var(--myf-viewport-height,100dvh); padding-top:max(12px,env(safe-area-inset-top,0px)); background:var(--m-overlay); overflow:hidden; }
.myf-dialog { display:flex; flex-direction:column; width:100%; max-width:540px; max-height:100%; min-height:0; border:1px solid var(--m-line); border-bottom:0; border-radius:var(--m-modal-radius) var(--m-modal-radius) 0 0; background:var(--m-panel); color:var(--m-text); box-shadow:0 -15px 70px var(--m-shadow); overflow:hidden; outline:none; }
.myf-dialog:focus-visible { outline:2px solid var(--m-accent); outline-offset:-3px; }
.myf-header { display:flex; align-items:flex-start; justify-content:space-between; flex:none; gap:12px; padding:22px 18px 18px 23px; border-bottom:1px solid var(--m-line); }
.myf-header>div { flex:1; min-width:0; }
.myf-eyebrow { display:flex; align-items:center; gap:6px; margin:0 0 6px; color:var(--m-accent); font-size:11px; line-height:1.5; letter-spacing:.08em; }
.myf-header h2 { margin:0; color:var(--m-text); font-size:23px; line-height:1.4; font-weight:600; }
.myf-description { margin:8px 0 0; color:var(--m-muted); font-size:12px; line-height:1.8; overflow-wrap:anywhere; }
.myf-close { display:grid; place-items:center; flex:none; width:44px; height:44px; margin:-4px -4px 0 0; padding:10px; border:0; border-radius:var(--m-control-radius); background:var(--m-card-surface); color:var(--m-text); }
.myf-body { flex:1; min-height:0; padding:20px 23px 24px; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
.myf-cache { margin:0 0 18px; color:var(--m-muted); font-size:12px; line-height:1.8; }
.myf-card { display:flex; flex-direction:column; align-items:center; gap:13px; margin:0 0 22px; text-align:center; }
.myf-card-art { display:grid; place-items:center; width:112px; aspect-ratio:350/554; border:1px solid var(--m-line-strong); border-radius:12px; background:var(--m-input-bg); box-shadow:0 9px 23px var(--m-shadow); overflow:hidden; }
.myf-card-art img { display:block; width:100%; height:100%; object-fit:contain; }
.myf-card-reversed { transform:rotate(180deg); }
.myf-card-art>span { padding:12px; color:var(--m-muted); font-size:11px; line-height:1.8; }
.myf-card figcaption { display:flex; flex-wrap:wrap; align-items:baseline; justify-content:center; gap:5px 9px; }
.myf-card figcaption strong { color:var(--m-text); font-size:16px; font-weight:600; }
.myf-card figcaption>span { color:var(--m-muted); font-size:12px; }
.myf-state { display:flex; flex-direction:column; align-items:center; gap:14px; min-height:170px; justify-content:center; padding:24px 12px; color:var(--m-muted); text-align:center; }
.myf-state>svg { flex:none; color:var(--m-accent); }
.myf-state h3 { margin:0; color:var(--m-text); font-size:16px; line-height:1.6; font-weight:600; }
.myf-state p { margin:0; font-size:13px; line-height:1.85; overflow-wrap:anywhere; }
.myf-error { min-height:0; margin-bottom:16px; padding:17px 14px; border:1px solid var(--m-line-strong); border-radius:15px; background:var(--m-error-bg); color:var(--m-error); }
.myf-retry { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:44px; padding:9px 15px; border:1px solid var(--m-line-strong); border-radius:var(--m-control-radius); background:transparent; color:var(--m-text); font:inherit; font-size:13px; }
.myf-footer { flex:none; padding:14px 23px calc(16px + env(safe-area-inset-bottom,0px)); border-top:1px solid var(--m-line); }
.myf-footer button { width:100%; min-height:44px; padding:11px 14px; border:1px solid var(--m-line-strong); border-radius:var(--m-control-radius); background:var(--m-accent-soft); color:var(--m-accent); font:inherit; font-size:14px; line-height:1.5; }
.myf-dialog button:focus-visible { outline:2px solid var(--m-accent); outline-offset:3px; }
.myf-dialog button:disabled { opacity:.5; cursor:wait; }
.myf-spin { animation:myf-spin 1.3s linear infinite; }
@keyframes myf-spin { to { transform:rotate(360deg); } }
@media(max-width:360px) { .myf-header { gap:8px; padding:21px 14px 16px 18px; } .myf-header h2 { font-size:22px; } .myf-body { padding:18px 17px 22px; } .myf-footer { padding-inline:18px; } }
@media(min-width:600px) { .myf-backdrop { align-items:center; padding:24px; } .myf-dialog { max-height:min(840px,100%); border:1px solid var(--m-line); border-radius:var(--m-modal-radius); } }
@media(prefers-reduced-motion:reduce) { .myf-spin { animation:none; } }
</style>
