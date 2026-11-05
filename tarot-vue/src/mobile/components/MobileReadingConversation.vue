<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ChatBubble from '@/components/ChatBubble.vue'
import UserRound from '@icons/user-round.vue'
import MobileReaderAvatar from './MobileReaderAvatar.vue'
import { findOfflineCard, getOfflineCardImageUrl } from '../data/offlineCards'
import { savedFollowups } from '../mobileModel'
import { conversationPresentation } from '../mobileConversationModel'
import type { MobileHistoryEntry, MobileReader } from '../types'

const props = withDefaults(defineProps<{
  entry: MobileHistoryEntry
  english: boolean
  reader?: MobileReader
  readerName: string
  positions?: string[]
  imageOverrides?: Record<number, string>
  pendingQuestion?: string
}>(), { positions: () => [], imageOverrides: () => ({}), pendingQuestion: '' })

const presentation = computed(() => conversationPresentation(props.entry))
const readerAvatar = computed(() => props.reader || (props.entry.type === 'reader-reading' && props.entry.readerId ? { id: props.entry.readerId } : undefined))
const followups = computed(() => savedFollowups(props.entry))
const conversation = ref<HTMLElement | null>(null)
let submittedFollowup: { question: string; count: number } | null = null
let scrollFrame = 0
let disposed = false

function cancelScroll() {
  if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
  scrollFrame = 0
}
function showFollowup(turn: number | 'pending') {
  cancelScroll()
  const entryId = props.entry.id
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0
    const root = conversation.value
    if (disposed || props.entry.id !== entryId || !root?.isConnected) return
    const target = root.querySelector<HTMLElement>(turn === 'pending'
      ? '.mrc-pending-question'
      : `.mrc-followup-answer[data-turn-index="${turn}"]`)
    if (!target) return
    const viewportTop = window.visualViewport?.offsetTop || 0
    const header = root.closest('.mobile-shell')?.querySelector('.mobile-header')
    const visibleTop = Math.max(viewportTop, header?.getBoundingClientRect().bottom || viewportTop)
    // Show the start of the new turn, rather than the end of a potentially long answer.
    window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - visibleTop - 20), behavior: 'instant' })
  })
}
watch(() => [props.entry.id, props.pendingQuestion, followups.value.length] as const, ([entryId, pending, count], [previousId, previousPending]) => {
  if (entryId !== previousId) { submittedFollowup = null; cancelScroll(); return }
  // Only a new submission observed on this screen may move the reading position.
  // Opening saved history or receiving a background detail refresh must stay put.
  if (pending && !previousPending) {
    submittedFollowup = { question: pending, count }
    showFollowup('pending')
  }
  const submitted = submittedFollowup
  if (submitted && count > submitted.count) {
    const index = followups.value.findIndex((turn, index) => index >= submitted.count && turn.question === submitted.question)
    if (index >= 0) { submittedFollowup = null; showFollowup(index); return }
  }
  if (!pending && previousPending && submittedFollowup) { submittedFollowup = null; cancelScroll() }
}, { flush: 'post' })
onBeforeUnmount(() => { disposed = true; submittedFollowup = null; cancelScroll() })
const question = computed(() => props.entry.question?.trim() || (props.entry.type === 'daily-fortune'
  ? props.english ? 'Your daily reading' : '每日启发'
  : props.english ? 'Your question' : '这次占卜'))
const failedImages = ref<Record<string, true>>({})
watch(() => [props.entry.id, props.imageOverrides], () => { failedImages.value = {} })
const cards = computed(() => (Array.isArray(props.entry.cardIds) ? props.entry.cardIds : []).flatMap((id, index) => {
  const original = findOfflineCard(id)
  if (!original) return []
  const orientation = props.entry.orientations?.[index]
  const isReversed = orientation === 'reversed'
  const knownOrientation = isReversed || orientation === 'upright'
  const direction = knownOrientation
    ? props.english ? isReversed ? 'Reversed' : 'Upright' : isReversed ? '逆位' : '正位'
    : props.english ? 'Orientation not recorded' : '方向未记录'
  return [{ id, index, isReversed, direction, orientation: knownOrientation ? orientation : 'unknown',
    name: props.english ? original.nameEn : original.name,
    position: props.positions[index] || (props.english ? `Card ${index + 1}` : `第 ${index + 1} 张牌`),
    offlineImage: getOfflineCardImageUrl(original.nameEn),
  }]
}))
type ConversationMessage = ReturnType<typeof conversationPresentation>['messages'][number]
type ConversationItem = { kind: 'message'; index: number; message: ConversationMessage } | { kind: 'cards' }
const items = computed(() => {
  const result: ConversationItem[] = []
  if (cards.value.length && presentation.value.cardsAfterMessage === -1) result.push({ kind: 'cards' })
  presentation.value.messages.forEach((message, index) => {
    result.push({ kind: 'message', index, message })
    if (cards.value.length && index === presentation.value.cardsAfterMessage) result.push({ kind: 'cards' })
  })
  return result
})
function cardImage(card: typeof cards.value[number]) {
  const override = props.imageOverrides[card.id]
  if (override && !failedImages.value[override]) return override
  return failedImages.value[card.offlineImage] ? '' : card.offlineImage
}
function onCardImageError(event: Event) {
  const source = (event.currentTarget as HTMLImageElement).dataset.source
  if (source) failedImages.value = { ...failedImages.value, [source]: true }
}
</script>

<template>
  <section ref="conversation" class="mrc-conversation" :aria-label="english ? 'Reading conversation' : '占卜对话'">
    <ChatBubble side="right" class="mrc-question">
      <template #avatar><UserRound :size="20" class="mrc-user-icon" aria-hidden="true" /></template>
      {{ question }}
    </ChatBubble>

    <template v-for="item in items" :key="item.kind === 'cards' ? `cards-${entry.id}` : `message-${item.index}`">
      <ChatBubble v-if="item.kind === 'message'" side="left" :name="readerName" class="mrc-reader-message" :data-message-index="item.index" :data-message-type="item.message.type">
        <template #avatar><MobileReaderAvatar :reader="readerAvatar" :name="readerName" :size="36" class="mrc-reader-avatar" /></template>
        {{ item.message.content }}
      </ChatBubble>

      <div v-else class="mrc-card-strip" role="group" :aria-label="english ? 'The cards in this reading' : '这次抽到的牌'" tabindex="0">
        <div class="mrc-card-row">
          <figure v-for="card in cards" :key="`${card.index}-${card.id}`" class="mrc-card" :data-card-id="card.id" :data-orientation="card.orientation">
            <div class="mrc-card-frame">
              <img v-if="cardImage(card)" :key="cardImage(card)" :src="cardImage(card)" :data-source="cardImage(card)" :alt="`${card.name} · ${card.direction}`" :class="{ 'mrc-reversed': card.isReversed }" loading="lazy" decoding="async" @error="onCardImageError">
              <span v-else class="mrc-card-fallback">{{ card.name }}</span>
            </div>
            <figcaption><strong class="mrc-card-name">{{ card.name }}</strong><span class="mrc-card-orientation">{{ card.direction }}</span><span class="mrc-card-position">{{ card.position }}</span></figcaption>
          </figure>
        </div>
      </div>
    </template>

    <p v-if="!presentation.messages.length" class="mrc-empty" role="status">{{ english ? 'This saved record has no interpretation to display.' : '这条记录暂时没有可显示的解读。' }}</p>

    <template v-for="(turn, index) in followups" :key="`followup-${index}`">
      <ChatBubble side="right" class="mrc-followup-question" :data-turn-index="index">
        <template #avatar><UserRound :size="20" class="mrc-user-icon" aria-hidden="true" /></template>
        {{ turn.question }}
      </ChatBubble>
      <ChatBubble side="left" :name="readerName" class="mrc-followup-answer" :data-turn-index="index">
        <template #avatar><MobileReaderAvatar :reader="readerAvatar" :name="readerName" :size="36" class="mrc-reader-avatar" /></template>
        {{ turn.answer }}
      </ChatBubble>
    </template>

    <template v-if="pendingQuestion">
      <ChatBubble side="right" class="mrc-pending-question">
        <template #avatar><UserRound :size="20" class="mrc-user-icon" aria-hidden="true" /></template>
        {{ pendingQuestion }}
      </ChatBubble>
      <ChatBubble side="left" :name="readerName" class="mrc-pending-answer">
        <template #avatar><MobileReaderAvatar :reader="readerAvatar" :name="readerName" :size="36" class="mrc-reader-avatar" /></template>
        <span class="mrc-waiting" role="status"><span class="mrc-waiting-label">{{ english ? 'Reading your follow-up…' : '正在继续解读…' }}</span><span class="mrc-typing" aria-hidden="true"><i /><i /><i /></span></span>
      </ChatBubble>
    </template>
  </section>
</template>

<style scoped>
.mrc-conversation { display:flex; flex-direction:column; gap:20px; min-width:0; }
.mrc-conversation :deep(.chat-bubble-enter) { min-width:0; }
.mrc-conversation :deep(.chat-bubble-enter > .min-w-0) { max-width:calc(100% - 48px); }
.mrc-conversation :deep(.whitespace-pre-wrap) { border-color:var(--m-line); background:var(--m-panel); color:var(--m-text); font-size:15px; line-height:1.85; overflow-wrap:anywhere; }
.mrc-conversation :deep(.flex-row-reverse .whitespace-pre-wrap) { border-color:var(--m-line-strong); background:var(--m-accent-soft); }
.mrc-conversation :deep(.chat-bubble-enter > .w-9) { background:var(--m-panel-raised); box-shadow:0 0 0 1px var(--m-line); }
.mrc-conversation :deep(.text-xs) { color:var(--m-muted); font-size:12px; line-height:1.6; overflow-wrap:anywhere; }
.mrc-reader-avatar { border:0; background:var(--m-accent-soft); color:var(--m-accent); }
.mrc-user-icon { color:var(--m-accent); }
.mrc-card-strip { min-width:0; margin:0; padding:8px 0 14px; overflow-x:auto; overscroll-behavior-inline:contain; scrollbar-width:thin; scrollbar-color:var(--m-line-strong) transparent; }
.mrc-card-strip:focus-visible { outline:2px solid var(--m-accent); outline-offset:3px; border-radius:8px; }
.mrc-card-row { display:flex; align-items:flex-start; gap:16px; width:max-content; min-width:100%; padding:0 0 0 48px; }
.mrc-card { display:flex; flex-direction:column; align-items:center; flex:none; width:100px; min-width:0; margin:0; }
.mrc-card-frame { display:flex; align-items:center; justify-content:center; width:96px; height:150px; overflow:hidden; border:2px solid var(--m-line-strong); border-radius:12px; background:var(--m-input-bg); box-shadow:0 8px 20px var(--m-shadow); }
.mrc-card-frame img { display:block; width:100%; height:100%; object-fit:contain; }
.mrc-card-frame img.mrc-reversed { transform:rotate(180deg); }
.mrc-card-fallback { padding:10px; color:var(--m-accent); font-size:13px; line-height:1.6; text-align:center; overflow-wrap:anywhere; }
.mrc-card figcaption { display:flex; flex-direction:column; align-items:center; gap:3px; width:100%; padding-top:9px; text-align:center; }
.mrc-card-name { color:var(--m-accent); font-size:14px; font-weight:500; line-height:1.6; overflow-wrap:anywhere; }
.mrc-card-orientation { color:var(--m-muted); font-size:12px; line-height:1.6; }
.mrc-card-position { color:var(--m-muted); font-size:12px; line-height:1.6; overflow-wrap:anywhere; }
.mrc-empty { margin:0; padding-left:48px; color:var(--m-muted); font-size:14px; line-height:1.8; }
.mrc-waiting { display:inline-flex; flex-wrap:wrap; align-items:center; gap:9px; color:var(--m-muted); font-size:14px; }
.mrc-typing { display:inline-flex; align-items:center; gap:5px; }
.mrc-typing i { display:block; width:5px; height:5px; border-radius:50%; background:var(--m-muted); animation:mrc-typing 1.2s ease-in-out infinite; }
.mrc-typing i:nth-child(2) { animation-delay:.15s; }
.mrc-typing i:nth-child(3) { animation-delay:.3s; }
@keyframes mrc-typing { 0%,60%,100% { opacity:.35; transform:translateY(0); } 30% { opacity:1; transform:translateY(-3px); } }
@media(max-width:360px) { .mrc-conversation { gap:18px; } .mrc-conversation :deep(.whitespace-pre-wrap) { padding:11px 13px; } .mrc-card-row { gap:12px; } }
@media(prefers-reduced-motion:reduce) { .mrc-conversation :deep(.chat-bubble-enter),.mrc-typing i { animation:none; } }
</style>
