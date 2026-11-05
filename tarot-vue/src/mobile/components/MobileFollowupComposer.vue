<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import ArrowUp from '@icons/arrow-up.vue'
import { followupValid } from '../mobileModel'

const props = withDefaults(defineProps<{
  modelValue: string
  question: string
  english: boolean
  busy: boolean
  pendingForCurrent: boolean
  online: boolean
  readerName?: string
}>(), { readerName: '' })
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: []; 'open-pending': [] }>()
const panel = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
const panelHeight = ref(142)
let observer: ResizeObserver | undefined
const text = (zh: string, en: string) => props.english ? en : zh
const sendDisabled = computed(() => props.busy || !props.online || !followupValid(props.modelValue))
const note = computed(() => {
  if (props.busy) return props.pendingForCurrent
    ? text('正在解读这条追问，完成后可继续。', 'This follow-up is being read. You can continue when it is ready.')
    : text('另一条问卜正在生成，完成后可发送。', 'Another reading is in progress. You can send when it is ready.')
  if (!props.online) return text('当前离线，可以先写下追问，联网后再发送。', 'You are offline. Write your question now and send when connected.')
  return text('沿用原问题与牌面 · 发送后使用 1 次额度', 'Keeps your question and cards · Sending uses 1 credit')
})
function measure() {
  if (panel.value) panelHeight.value = Math.ceil(panel.value.getBoundingClientRect().height)
}
function resizeInput() {
  if (!input.value) return
  input.value.style.height = 'auto'
  input.value.style.height = `${Math.max(48, Math.min(112, input.value.scrollHeight))}px`
  measure()
}
function update(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  resizeInput()
}
function submit() { if (!sendDisabled.value) emit('submit') }
watch(() => [props.modelValue, props.english, props.question, props.readerName, props.busy, props.pendingForCurrent, props.online], async () => {
  await nextTick(); resizeInput()
})
onMounted(() => {
  resizeInput()
  if (typeof ResizeObserver !== 'undefined' && panel.value) {
    observer = new ResizeObserver(measure); observer.observe(panel.value)
  }
  window.addEventListener('resize', resizeInput)
})
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('resize', resizeInput) })
</script>

<template>
  <div class="mobile-composer-spacer" :style="{ height: `${panelHeight}px` }" aria-hidden="true" />
  <form ref="panel" class="mobile-composer" :aria-label="text('继续当前问题的追问', 'Continue this reading')" @submit.prevent="submit">
    <div class="mobile-composer-heading">
      <div class="mobile-composer-title">
        <label for="mobile-followup">{{ text('继续追问', 'Ask a follow-up') }}</label>
        <span v-if="readerName" id="mobile-followup-reader" class="mobile-composer-reader" :title="text(`继续与 ${readerName} 对话`, `Continue with ${readerName}`)">{{ text(`与 ${readerName} 对话`, `With ${readerName}`) }}</span>
      </div>
      <button v-if="busy && !pendingForCurrent" type="button" class="mobile-pending-shortcut" @click="emit('open-pending')">{{ text('查看进行中的问卜', 'Open the reading in progress') }} →</button>
    </div>
    <p id="mobile-followup-context" class="mobile-composer-context" :title="question">{{ text('关于：', 'About: ') }}{{ question }}</p>
    <div class="mobile-composer-input-row">
      <textarea ref="input" id="mobile-followup" :value="modelValue" rows="1" maxlength="200" :disabled="busy" :placeholder="text('还有什么想问的？', 'What else would you like to ask?')" :aria-describedby="`${readerName ? 'mobile-followup-reader ' : ''}mobile-followup-context mobile-followup-note`" @input="update" />
      <button type="submit" class="mobile-send" :aria-label="text('发送追问', 'Send follow-up')" :disabled="sendDisabled"><ArrowUp :size="22" aria-hidden="true" /></button>
    </div>
    <p id="mobile-followup-note" class="mobile-composer-note" :role="busy || !online ? 'status' : undefined">{{ note }}</p>
  </form>
</template>

<style scoped>
.mobile-composer-spacer { flex-shrink: 0; width: 100%; }
.mobile-composer { position: fixed; z-index: 25; bottom: calc(var(--m-nav-height, 76px) + env(safe-area-inset-bottom, 0px)); left: 50%; transform: translateX(-50%); width: 100%; max-width: 540px; margin: 0; padding: 14px 22px 12px; border-top: 1px solid var(--m-line-strong); background: var(--m-panel); box-shadow: 0 -12px 28px var(--m-shadow); }
.mobile-composer-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 5px 12px; min-height: 23px; }
.mobile-composer-title { display: flex; align-items: baseline; flex: 1 1 100%; gap: 10px; min-width: 0; }
.mobile-composer-heading label { flex: none; font-size: 14px; color: var(--m-text); font-weight: 500; white-space: nowrap; }
.mobile-composer-reader { flex: 1; min-width: 0; color: var(--m-accent); font-size: 12px; line-height: 1.6; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-composer-context { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--m-muted); font-size: 12px; line-height: 1.6; margin: 3px 0 9px; }
.mobile-composer-input-row { display: flex; align-items: flex-end; gap: 10px; }
.mobile-composer textarea { display: block; flex: 1; width: 100%; min-width: 0; min-height: 48px; max-height: 112px; padding: 11px 12px; border: 1px solid var(--m-line-strong); border-radius: var(--m-control-radius); background: var(--m-input-bg); color: var(--m-text); font: inherit; font-size: 16px; line-height: 1.5; resize: none; overflow-y: auto; }
.mobile-composer textarea::placeholder { color: var(--m-muted); }
.mobile-send { display: grid; place-content: center; flex-shrink: 0; width: var(--m-button-height); height: var(--m-button-height); margin: 0; border: 0; border-radius: var(--m-control-radius); background: var(--m-accent); color: var(--m-accent-ink); }
.mobile-composer-note { font-size: 12px; color: var(--m-muted); line-height: 1.6; margin: 7px 0 0; }
.mobile-pending-shortcut { padding: 5px 0; min-height: var(--m-tool-height); background: none; border: 0; color: var(--m-accent); font-size: 11px !important; line-height: 1.5; text-align: left; }
:global(.mobile-keyboard .mobile-composer) { bottom: 0; }
@media (max-width: 360px) { .mobile-composer { padding-inline: 18px; } }
</style>
