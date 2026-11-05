<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { User } from '@/stores/auth'
import XIcon from '@icons/x.vue'
import ImageIcon from '@icons/image.vue'
import UserRound from '@icons/user-round.vue'
import { publicAssetUrl } from '@/utils/publicAssetUrl'
import { birthInputError, localDateOnly, prepareMobileAvatar } from '../mobileProfile'

const props = defineProps<{ mode: 'avatar' | 'birth'; user: User; english: boolean; busy: boolean; loading: boolean; error: string }>()
const emit = defineEmits<{ close: []; avatar: [file: File]; birth: [value: { birthday: string | null; birthTime: string | null }]; retry: []; change: [] }>()
const t = (zh: string, en: string) => props.english ? en : zh
const dialog = ref<HTMLElement | null>(null), input = ref<HTMLInputElement | null>(null)
const date = ref(''), time = ref(''), unknown = ref(true), localError = ref(''), preparing = ref(false)
const selected = ref<File | null>(null), preview = ref(''), imageFailed = ref(false)
let imageSequence = 0, disposed = false
const previousFocus = document.activeElement as HTMLElement | null
let previousOverflow = ''
const avatarUrl = computed(() => preview.value || (/^(https?:\/\/|\/uploads\/)/i.test(props.user.avatar || '') ? publicAssetUrl(props.user.avatar) : ''))
const locked = computed(() => props.busy || preparing.value)
const message = computed(() => localError.value || props.error)
function resetBirth() {
  date.value = props.user.birthday?.slice(0, 10) || ''
  time.value = props.user.birthTime?.slice(0, 5) || ''; unknown.value = !time.value
}
watch(() => [props.user.birthday, props.user.birthTime, props.loading], () => { if (!props.loading) resetBirth() }, { immediate: true })
watch(avatarUrl, () => { imageFailed.value = false })
function changed() { localError.value = ''; emit('change') }
function clearBirth() { date.value = ''; time.value = ''; unknown.value = true; changed() }
function close() { if (!locked.value) emit('close') }
function releasePreview() { if (preview.value) URL.revokeObjectURL(preview.value); preview.value = '' }
async function choose(event: Event) {
  const element = event.target as HTMLInputElement, file = element.files?.[0]
  element.value = ''; if (!file) return
  const action = ++imageSequence; changed(); preparing.value = true; selected.value = null; releasePreview()
  try {
    const prepared = await prepareMobileAvatar(file, props.english)
    if (disposed || action !== imageSequence) return
    selected.value = prepared; preview.value = URL.createObjectURL(prepared)
  } catch (error) { if (!disposed && action === imageSequence) localError.value = error instanceof Error ? error.message : t('图片处理失败，请重试。', 'Could not prepare this image. Try again.') }
  finally { if (action === imageSequence) preparing.value = false }
}
function submit() {
  if (locked.value || props.loading) return
  localError.value = ''
  if (props.mode === 'avatar') {
    if (!selected.value) { localError.value = t('请先选择一张图片。', 'Choose an image first.'); return }
    emit('avatar', selected.value)
  } else {
    localError.value = birthInputError(date.value, time.value, unknown.value, props.english)
    if (localError.value) return
    emit('birth', { birthday: date.value || null, birthTime: !date.value || unknown.value ? null : time.value })
  }
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')).filter(node => node.getClientRects().length)
  const first = focusable[0], last = focusable[focusable.length - 1]
  if (!first || !last) { event.preventDefault(); dialog.value.focus(); return }
  if (!dialog.value.contains(document.activeElement) || document.activeElement === dialog.value) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(async () => { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.addEventListener('keydown', keydown); await nextTick(); dialog.value?.focus() })
onBeforeUnmount(() => { disposed = true; imageSequence++; releasePreview(); document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); if (previousFocus?.isConnected) previousFocus.focus() })
</script>

<template>
  <div class="profile-editor-backdrop" @click.self="close">
    <section ref="dialog" class="profile-editor" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title" tabindex="-1">
      <header><div><p>E-Tomd</p><h2 id="profile-editor-title">{{ mode === 'avatar' ? t('更换头像', 'Change avatar') : t('生辰设置', 'Birth details') }}</h2></div><button class="profile-editor-close" type="button" :disabled="locked" :aria-label="t('关闭', 'Close')" @click="close"><XIcon :size="22" /></button></header>
      <form @submit.prevent="submit">
        <template v-if="mode === 'avatar'">
          <div class="profile-avatar-preview"><img v-if="avatarUrl && !imageFailed" :src="avatarUrl" :alt="t('头像预览', 'Avatar preview')" @error="imageFailed = true"><UserRound v-else :size="58" /></div>
          <p class="profile-editor-note">{{ t('图片将居中裁成方形，保存后同步到你的账号。', 'Your image will be cropped to a centered square and saved to your account.') }}</p>
          <input ref="input" class="profile-file-input" hidden type="file" accept="image/jpeg,image/png,image/webp" :disabled="locked" :aria-label="t('选择头像图片', 'Choose avatar image')" @change="choose">
          <button class="profile-choose" type="button" :disabled="locked" @click="input?.click()"><ImageIcon :size="20" />{{ preparing ? t('正在处理图片…', 'Preparing image…') : t('从相册选择图片', 'Choose an image') }}</button>
          <p class="profile-editor-hint">JPG / PNG / WebP · {{ t('支持自动压缩', 'Automatically resized') }}</p>
        </template>
        <template v-else>
          <p class="profile-editor-note">{{ t('设置公历生日与出生时刻。不知道具体时刻，可以留空。', 'Set your Gregorian birth date and optional birth time. Leave the time unknown if you are unsure.') }}</p>
          <p v-if="loading" class="profile-editor-loading" role="status">{{ t('正在读取生辰信息…', 'Loading birth details…') }}</p>
          <fieldset :disabled="loading || busy"><label for="mobile-birthday">{{ t('出生日期（公历）', 'Birth date (Gregorian)') }}</label><input id="mobile-birthday" v-model="date" type="date" :max="localDateOnly()" @input="changed"><div class="profile-time-heading"><label for="mobile-birth-time">{{ t('出生时刻', 'Birth time') }}</label><label class="profile-unknown"><input v-model="unknown" type="checkbox" @change="changed">{{ t('不知道', 'I don’t know') }}</label></div><input id="mobile-birth-time" v-model="time" type="time" step="60" :disabled="unknown" @input="changed"><p class="profile-editor-hint">{{ t('按你出生地当时的当地时间填写。', 'Use the local time at your birthplace.') }}</p><button class="profile-clear" type="button" @click="clearBirth">{{ t('清空生辰信息', 'Clear birth details') }}</button></fieldset>
        </template>
        <div v-if="message" class="profile-editor-error" role="alert">{{ message }}<button v-if="mode === 'birth' && loading === false && error && !busy" type="button" @click="emit('retry')">{{ t('重新读取', 'Reload') }}</button></div>
        <footer><button type="button" class="profile-cancel" :disabled="locked" @click="close">{{ t('取消', 'Cancel') }}</button><button class="profile-save" type="submit" :disabled="locked || loading || (mode === 'avatar' && !selected)">{{ busy ? t('正在保存…', 'Saving…') : t('保存', 'Save') }}</button></footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.profile-editor-backdrop { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center; padding: max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; background: #08060dcc; backdrop-filter: blur(8px); }
.profile-editor { width: 100%; max-width: 430px; max-height: calc(100dvh - 36px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); overflow-y: auto; min-width: 0; padding: 24px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 24px; outline: none; background: var(--m-card-surface, #211b29); color: var(--m-text, #f1ecf4); box-shadow: 0 24px 90px #0008; }
.profile-editor header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 22px; }
.profile-editor header p { margin: 0 0 4px; color: var(--m-muted, #b6a8c6); font-size: 11px; letter-spacing: .16em; }
.profile-editor h2 { margin: 0; font-family: var(--m-heading-font, 'Songti SC', 'SimSun', serif); font-size: 23px; line-height: 1.5; font-weight: 500; }
.profile-editor-close { display: grid; place-items: center; width: 44px; height: 44px; flex: none; margin: -7px -8px 0 0; padding: 0; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: transparent; color: var(--m-text, #f1ecf4); }
.profile-editor :where(button) { font: inherit; cursor: pointer; touch-action: manipulation; }
.profile-editor button:disabled { opacity: .5; cursor: default; }
.profile-editor :is(input, button):focus-visible { outline: 2px solid var(--m-accent, #cbb0ed); outline-offset: 3px; }
.profile-avatar-preview { display: grid; place-items: center; width: 136px; height: 136px; overflow: hidden; margin: 0 auto 21px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 50%; background: var(--m-bg, #151019); color: var(--m-accent, #cbb0ed); }
.profile-avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
.profile-editor-note { margin: 0 0 20px; color: var(--m-muted, #b6a8c6); font-size: 13px; line-height: 1.9; overflow-wrap: anywhere; }
.profile-file-input { position: absolute; width: 1px; height: 1px; padding: 0; opacity: 0; overflow: hidden; pointer-events: none; }
.profile-choose { display: flex; gap: 10px; align-items: center; justify-content: center; width: 100%; min-height: 48px; padding: 10px 16px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: transparent; color: var(--m-text, #f1ecf4); font-size: 14px; }
.profile-editor-hint { margin: 10px 0 0; color: var(--m-muted, #b6a8c6); font-size: 11px; line-height: 1.8; overflow-wrap: anywhere; }
.profile-editor fieldset { padding: 0; margin: 0; border: 0; min-width: 0; }
.profile-editor fieldset > label { display: block; margin-bottom: 9px; color: var(--m-text, #f1ecf4); font-size: 13px; }
.profile-editor input[type=date], .profile-editor input[type=time] { display: block; width: 100%; min-width: 0; min-height: 48px; padding: 10px 12px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; box-sizing: border-box; background: var(--m-bg, #151019); color: var(--m-text, #f1ecf4); font: inherit; font-size: 16px; color-scheme: dark; }
.profile-editor input:disabled { opacity: .4; }
.profile-time-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 16px 0 9px; color: var(--m-text, #f1ecf4); font-size: 13px; }
.profile-unknown { display: flex; align-items: center; gap: 7px; min-height: 44px; font-size: 12px; cursor: pointer; }
.profile-unknown input { width: 17px; height: 17px; margin: 0; accent-color: var(--m-accent, #cbb0ed); }
.profile-clear { display: block; margin: 15px 0 0; padding: 6px 0; min-height: 44px; border: 0; background: transparent; color: var(--m-muted, #b6a8c6); font-size: 12px !important; }
.profile-editor-error { margin: 18px 0 0; color: #ffc7c7; font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
.profile-editor-error button { display: block; min-height: 44px; padding: 5px 0; border: 0; background: transparent; color: var(--m-accent, #cbb0ed); }
.profile-editor-loading { color: var(--m-muted, #b6a8c6); font-size: 13px; }
.profile-editor footer { display: grid; grid-template-columns: 1fr 1.35fr; gap: 12px; margin-top: 24px; }
.profile-editor footer button { min-height: 48px; padding: 10px 16px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; font-size: 14px; }
.profile-cancel { background: transparent; color: var(--m-text, #f1ecf4); }
.profile-save { background: var(--m-accent, #cbb0ed); border-color: transparent !important; color: var(--m-accent-ink, #291d35); font-weight: 600 !important; }
@media (max-height: 600px) {
  .profile-editor-backdrop { align-items: flex-start; padding-block: 12px; }
  .profile-editor { max-height: calc(100dvh - 24px); padding: 20px; }
  .profile-editor header { margin-bottom: 15px; }
  .profile-editor-note { margin-bottom: 14px; }
  .profile-avatar-preview { width: 100px; height: 100px; margin-bottom: 14px; }
}
@media (prefers-reduced-motion: reduce) { .profile-editor-backdrop { backdrop-filter: none; } }
</style>
