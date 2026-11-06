<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import XIcon from '@icons/x.vue'
import { nicknameInputError } from '../mobileProfile'

const props = defineProps<{ nickname: string; english: boolean; busy: boolean; error: string }>()
const emit = defineEmits<{ close: []; save: [value: string]; change: [] }>()
const t = (zh: string, en: string) => props.english ? en : zh
const dialog = ref<HTMLElement | null>(null), input = ref<HTMLInputElement | null>(null)
// Keep the local edit when a background profile refresh changes the prop.
const value = ref(props.nickname), localError = ref('')
const trimmed = computed(() => value.value.trim())
const unchanged = computed(() => trimmed.value === props.nickname.trim())
const message = computed(() => localError.value || props.error)
const previousFocus = document.activeElement as HTMLElement | null
let previousOverflow = ''

function changed() { localError.value = ''; emit('change') }
function close() { if (!props.busy) emit('close') }
function submit() {
  if (props.busy || unchanged.value) return
  localError.value = nicknameInputError(value.value, props.english)
  if (localError.value) { input.value?.focus(); return }
  emit('save', trimmed.value)
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex="0"]')).filter(node => node.getClientRects().length)
  const first = focusable[0], last = focusable[focusable.length - 1]
  if (!first || !last) { event.preventDefault(); dialog.value.focus(); return }
  if (!dialog.value.contains(document.activeElement) || document.activeElement === dialog.value) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(async () => {
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', keydown)
  await nextTick(); input.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown)
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <div class="nickname-editor-backdrop" @click.self="close">
    <section ref="dialog" class="nickname-editor" role="dialog" aria-modal="true" aria-labelledby="nickname-editor-title" tabindex="-1">
      <header><div><p>E-Tomd</p><h2 id="nickname-editor-title">{{ t('修改昵称', 'Edit nickname') }}</h2></div><button class="nickname-editor-close" type="button" :disabled="busy" :aria-label="t('关闭', 'Close')" @click="close"><XIcon :size="22" /></button></header>
      <form novalidate @submit.prevent="submit">
        <p class="nickname-editor-note">{{ t('昵称会显示在首页和个人中心。', 'Your nickname appears on the home and account pages.') }}</p>
        <div class="nickname-editor-label"><label for="mobile-nickname">{{ t('昵称', 'Nickname') }}</label><span aria-live="polite">{{ trimmed.length }} / 20</span></div>
        <input id="mobile-nickname" ref="input" v-model="value" type="text" name="nickname" autocomplete="nickname" autocapitalize="off" :spellcheck="false" enterkeyhint="done" maxlength="100" :disabled="busy" :aria-invalid="!!localError" :aria-describedby="message ? 'nickname-editor-hint nickname-editor-error' : 'nickname-editor-hint'" @input="changed">
        <p id="nickname-editor-hint" class="nickname-editor-hint">{{ t('2–20 个字符，保存时会去掉首尾空格。', 'Use 2–20 characters. Spaces at the start and end are removed when saving.') }}</p>
        <p v-if="message" id="nickname-editor-error" class="nickname-editor-error" role="alert">{{ message }}</p>
        <footer><button type="button" class="nickname-cancel" :disabled="busy" @click="close">{{ t('取消', 'Cancel') }}</button><button class="nickname-save" type="submit" :disabled="busy || unchanged">{{ busy ? t('正在保存…', 'Saving…') : t('保存昵称', 'Save nickname') }}</button></footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.nickname-editor-backdrop { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; padding: max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; background: #08060dcc; backdrop-filter: blur(8px); }
.nickname-editor { width: 100%; max-width: 430px; max-height: calc(100dvh - 36px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); overflow-y: auto; min-width: 0; padding: 24px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 24px; outline: none; background: var(--m-card-surface, #211b29); color: var(--m-text, #f1ecf4); box-shadow: 0 24px 90px #0008; }
.nickname-editor header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 22px; }
.nickname-editor header p { margin: 0 0 4px; color: var(--m-muted, #b6a8c6); font-size: 11px; letter-spacing: .16em; }
.nickname-editor h2 { margin: 0; font-family: var(--m-heading-font, 'Songti SC', 'SimSun', serif); font-size: 23px; line-height: 1.5; font-weight: 500; }
.nickname-editor-close { display: grid; place-items: center; width: 44px; height: 44px; flex: none; margin: -7px -8px 0 0; padding: 0; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: transparent; color: var(--m-text, #f1ecf4); }
.nickname-editor :where(button) { font: inherit; cursor: pointer; touch-action: manipulation; }
.nickname-editor button:disabled { opacity: .5; cursor: default; }
.nickname-editor :is(input, button):focus-visible { outline: 2px solid var(--m-accent, #cbb0ed); outline-offset: 3px; }
.nickname-editor-note { margin: 0 0 20px; color: var(--m-muted, #b6a8c6); font-size: 13px; line-height: 1.9; overflow-wrap: anywhere; }
.nickname-editor-label { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 9px; color: var(--m-text, #f1ecf4); font-size: 13px; }
.nickname-editor-label span { flex: none; color: var(--m-muted, #b6a8c6); font-size: 12px; }
.nickname-editor input { display: block; width: 100%; min-width: 0; min-height: 48px; padding: 10px 12px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; box-sizing: border-box; background: var(--m-bg, #151019); color: var(--m-text, #f1ecf4); font: inherit; font-size: 16px; }
.nickname-editor input[aria-invalid=true] { border-color: #ffc7c7; }
.nickname-editor input:disabled { opacity: .5; }
.nickname-editor-hint { margin: 10px 0 0; color: var(--m-muted, #b6a8c6); font-size: 11px; line-height: 1.8; overflow-wrap: anywhere; }
.nickname-editor-error { margin: 18px 0 0; color: #ffc7c7; font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
.nickname-editor footer { display: grid; grid-template-columns: 1fr 1.35fr; gap: 12px; margin-top: 24px; }
.nickname-editor footer button { min-height: 48px; padding: 10px 16px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; font-size: 14px; line-height: 1.5; }
.nickname-cancel { background: transparent; color: var(--m-text, #f1ecf4); }
.nickname-save { background: var(--m-accent, #cbb0ed); border-color: transparent !important; color: var(--m-button-text, #24192d); font-weight: 600 !important; }
@media (max-width: 360px) { .nickname-editor { padding: 20px; } .nickname-editor footer { gap: 10px; } .nickname-editor footer button { padding-inline: 10px; } }
</style>
