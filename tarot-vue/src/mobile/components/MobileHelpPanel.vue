<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { App } from '@capacitor/app'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import XIcon from '@icons/x.vue'
import version from '../../../mobile-version.json'
import { mobileApi, mobileUser } from '../mobileApi'
import { readMobileValue, writeMobileValue } from '../mobileStorage'
import {
  createMobileFeedbackController, createMobileFeedbackDiagnostics, createMobileFeedbackState,
  mobileFeedbackContentLimit, mobileFeedbackStorageKey,
} from '../mobileFeedback'

const props = defineProps<{ owner: number | null; english: boolean; online: boolean }>()
const emit = defineEmits<{ close: [] }>()
const t = (zh: string, en: string) => props.english ? en : zh
const state = reactive(createMobileFeedbackState())
const dialog = ref<HTMLElement | null>(null), body = ref<HTMLElement | null>(null)
const activeTab = ref<'help' | 'feedback'>('help'), closing = ref(false), closeFailure = ref(false)
let controller: ReturnType<typeof createMobileFeedbackController> | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined, disposed = false, userSelectedTab = false
let nativeListener: PluginListenerHandle | undefined
const previousFocus = document.activeElement as HTMLElement | null
let previousOverflow = ''

const diagnostics = computed(() => createMobileFeedbackDiagnostics({
  version: version.version, versionCode: version.versionCode,
  platform: Capacitor.getPlatform(), userAgent: navigator.userAgent, english: props.english,
}))
const contentLimit = computed(() => mobileFeedbackContentLimit(state, diagnostics.value))
const hasDraft = computed(() => Boolean(state.content || state.contact || state.errorCode))
const locked = computed(() => state.loading || state.loadError || state.busy || closing.value)
const types = computed(() => [
  { value: 'bug', label: t('使用问题', 'A problem') },
  { value: 'feature', label: t('功能建议', 'A suggestion') },
  { value: 'complaint', label: t('服务反馈', 'Service feedback') },
  { value: 'other', label: t('其他', 'Other') },
])
const faqs = computed(() => [
  { title: t('每日运势会每天换牌吗？', 'Does the daily card change every day?'), text: t('当日抽取的牌面与结果会保留，重新打开 APP 仍可查看。到新的业务日后可抽取当天运势；结果页可查看已保存的昨日结果。', 'Your daily card and result are kept when you reopen the app. A new business day brings a new daily draw. The result page also lets you view a saved result from yesterday.') },
  { title: t('翻牌后如何修改问题或重新开始？', 'Can I edit my question or draw again?'), text: t('翻牌后返回可以修改问题，原牌和方向保持不变。需要另一组牌时，点击问卜页面右上方“新问卜”开始另一局。', 'You can go back to edit your question after revealing cards. The cards and their orientations stay the same. Choose “New reading” in the top corner to start another draw.') },
  { title: t('如何继续之前的追问？', 'How do I continue a previous reading?'), text: t('登录后进入“记录”，打开原来的解读，在页面下方继续追问。追问沿用原来的牌面与塔罗师。', 'Sign in, open Readings and select the original reading. Continue with a follow-up at the bottom of that page, using its original cards and reader.') },
  { title: t('登录或忘记密码怎么办？', 'How do I sign in or reset my password?'), text: t('使用同一服务地区的网站账号登录。忘记密码时，在登录页选择“忘记密码”，按邮件中的步骤设置新密码，再回到 APP 登录。', 'Use the website account for the same service region. If you forget your password, choose “Forgot password” on the sign-in page, follow the email instructions and return to the app to sign in.') },
  { title: t('会员兑换后在哪里查看？', 'Where can I check a redeemed membership?'), text: t('在“我的 → 兑换会员”输入兑换码。兑换成功后，个人中心会显示会员状态与有效期；点击“查看权益”可了解当前权益。', 'Enter your code in Account → Redeem membership. After redemption, Account shows your membership status and expiry. Select “View benefits” for the current benefits.') },
  { title: t('如何更新安卓 APP？', 'How do I update the Android app?'), text: t('进入“我的 → 版本更新”检查新版，按提示下载并安装。如果系统要求允许此来源安装，请在系统设置中授权后返回继续。', 'Open Account → App updates to check for a new version, download it and install it. If Android asks you to allow updates from this app, allow the source in system settings and return to continue.') },
])
const lastSentTime = computed(() => {
  if (!state.lastSentAt) return ''
  const date = new Date(state.lastSentAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(props.english ? 'en-US' : 'zh-CN')
})

function cancelSave() { if (saveTimer !== undefined) clearTimeout(saveTimer); saveTimer = undefined }
function selectTab(value: 'help' | 'feedback') { userSelectedTab = true; activeTab.value = value; body.value?.scrollTo({ top: 0 }) }
function changed() {
  controller?.edit(); closeFailure.value = false; cancelSave()
  saveTimer = setTimeout(() => { saveTimer = undefined; if (!disposed) void controller?.saveDraft() }, 300)
}
async function flushDraft() {
  cancelSave()
  if (disposed || !controller || state.loading || state.loadError) return !hasDraft.value
  return controller.saveDraft()
}
async function requestClose() {
  if (disposed || closing.value) return
  closing.value = true
  const saved = await flushDraft()
  if (disposed) return
  if (!saved && hasDraft.value) {
    closeFailure.value = true; closing.value = false
    await nextTick(); dialog.value?.querySelector<HTMLElement>('.help-close-warning')?.focus()
    return
  }
  emit('close')
}
function discardAndClose() { if (!disposed) emit('close') }
async function submit() {
  cancelSave(); closeFailure.value = false
  await controller?.submit()
  if (disposed) return
  if (state.validation) { await nextTick(); dialog.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus() }
}
async function reloadDraft() { await controller?.load() }
function background() { if (!disposed) void flushDraft() }
function visibility() { if (document.hidden) background() }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); void requestClose(); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]')).filter(el => el.getClientRects().length)
  const first = focusable[0], last = focusable[focusable.length - 1]
  if (!first || !last) { event.preventDefault(); dialog.value.focus(); return }
  if (!dialog.value.contains(document.activeElement) || document.activeElement === dialog.value) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => props.owner, owner => {
  controller?.dispose(); cancelSave(); Object.assign(state, createMobileFeedbackState())
  activeTab.value = 'help'; userSelectedTab = false; closeFailure.value = false; closing.value = false
  const key = mobileFeedbackStorageKey(owner)
  const next = createMobileFeedbackController(state, {
    owner, isCurrentOwner: () => !disposed && props.owner === owner && (mobileUser.value?.id ?? null) === owner,
    connected: () => props.online,
    read: () => readMobileValue(key), write: draft => writeMobileValue(key, draft),
    send: async payload => (await mobileApi.post('/feedback', payload)).data,
    diagnostics: () => diagnostics.value, english: () => props.english,
  })
  controller = next
  void next.load().then(() => { if (!disposed && controller === next && !userSelectedTab && hasDraft.value) activeTab.value = 'feedback' })
}, { immediate: true, flush: 'sync' })

defineExpose({ requestClose, flushDraft })
onMounted(async () => {
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', background)
  if (Capacitor.isNativePlatform()) {
    void App.addListener('appStateChange', ({ isActive }) => { if (!isActive) background() }).then(handle => {
      if (disposed) void handle.remove().catch(() => {}); else nativeListener = handle
    }).catch(() => {})
  }
  await nextTick(); dialog.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  disposed = true; cancelSave(); controller?.dispose()
  document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown)
  document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', background)
  void nativeListener?.remove().catch(() => {})
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <div class="help-panel-backdrop" @click.self="requestClose">
    <section ref="dialog" class="help-panel" role="dialog" aria-modal="true" aria-labelledby="mobile-help-title" tabindex="-1">
      <header class="help-heading"><div><p>E-Tomd</p><h2 id="mobile-help-title">{{ t('帮助与反馈', 'Help & feedback') }}</h2></div><button class="help-close" type="button" :disabled="closing" :aria-label="t('关闭', 'Close')" @click="requestClose"><XIcon :size="22" /></button></header>
      <nav class="help-tabs" :aria-label="t('帮助与反馈页面', 'Help and feedback pages')"><button type="button" :aria-pressed="activeTab === 'help'" @click="selectTab('help')">{{ t('常见问题', 'Help') }}</button><button type="button" :aria-pressed="activeTab === 'feedback'" @click="selectTab('feedback')">{{ t('提交反馈', 'Feedback') }}<span v-if="hasDraft" class="help-draft-dot" :aria-label="t('有草稿', 'Draft available')"></span></button></nav>
      <div ref="body" class="help-body">
        <div v-if="activeTab === 'help'" class="help-faq" :aria-label="t('常见问题', 'Frequently asked questions')"><p class="help-intro">{{ t('先看看这里，或直接告诉我们遇到的问题。', 'Find an answer here, or tell us what happened.') }}</p><details v-for="item in faqs" :key="item.title"><summary>{{ item.title }}</summary><p>{{ item.text }}</p></details><button type="button" class="help-secondary help-write" @click="selectTab('feedback')">{{ t('仍需帮助？提交反馈', 'Still need help? Send feedback') }}</button></div>
        <form v-else class="help-feedback" novalidate :aria-busy="state.busy" @submit.prevent="submit">
          <p class="help-intro">{{ t('描述你遇到的问题或希望改进的地方。草稿只保存在此设备，不会自动发送。', 'Describe a problem or an improvement. Drafts stay on this device and are never sent automatically.') }}</p>
          <p v-if="state.loading" class="help-note" role="status">{{ t('正在读取本机草稿…', 'Loading your local draft…') }}</p>
          <div v-if="state.loadError" class="help-error" role="alert"><p>{{ t('本机草稿暂未能读取，请重试。', 'Your local draft could not be loaded. Please retry.') }}</p><button type="button" class="help-text-button" @click="reloadDraft">{{ t('重新读取草稿', 'Reload draft') }}</button></div>
          <fieldset :disabled="locked">
            <label for="mobile-feedback-type">{{ t('反馈类型', 'Feedback type') }}</label><select id="mobile-feedback-type" v-model="state.type" :aria-invalid="state.validationField === 'type'" :aria-describedby="state.validationField === 'type' ? 'mobile-feedback-validation' : undefined" @change="changed"><option v-for="item in types" :key="item.value" :value="item.value">{{ item.label }}</option></select>
            <div class="help-label"><label for="mobile-feedback-content">{{ t('反馈内容', 'Your feedback') }}</label><span :class="{ 'help-count-over': state.content.trim().length > contentLimit }">{{ state.content.trim().length }} / {{ contentLimit }}</span></div>
            <textarea id="mobile-feedback-content" v-model="state.content" rows="5" maxlength="2000" :aria-invalid="state.validationField === 'content'" :aria-describedby="state.validationField === 'content' ? 'mobile-feedback-validation' : undefined" :placeholder="t('例如：在哪个页面、进行什么操作时遇到了问题？', 'For example: Which page were you on, and what were you doing?')" @input="changed"></textarea>
            <label for="mobile-feedback-contact">{{ t('联系方式（可选）', 'Contact details (optional)') }}</label><input id="mobile-feedback-contact" v-model="state.contact" type="text" autocomplete="email" maxlength="100" :aria-invalid="state.validationField === 'contact'" :aria-describedby="state.validationField === 'contact' ? 'mobile-feedback-validation' : undefined" :placeholder="t('邮箱或其他方便联系你的方式', 'An email or another way to contact you')" @input="changed">
            <div class="help-diagnostics"><label class="help-check"><input v-model="state.includeDiagnostics" type="checkbox" @change="changed"><span>{{ t('附带基础故障信息', 'Include basic diagnostics') }}</span></label><p>{{ t('仅附带 APP 版本、系统版本、语言和你填写的错误编号，不会自动读取问卜内容、生辰或登录信息。', 'Includes only the app version, system version, language and an error code you enter. Reading content, birth details and sign-in information are not collected automatically.') }}</p><template v-if="state.includeDiagnostics"><label for="mobile-feedback-code">{{ t('页面上的错误编号（可选）', 'Error code shown on screen (optional)') }}</label><input id="mobile-feedback-code" v-model="state.errorCode" type="text" autocapitalize="off" autocomplete="off" maxlength="64" :spellcheck="false" :aria-invalid="state.validationField === 'errorCode'" :aria-describedby="state.validationField === 'errorCode' ? 'mobile-feedback-validation' : undefined" @input="changed"></template></div>
          </fieldset>
          <p v-if="state.validation" id="mobile-feedback-validation" class="help-error" role="alert">{{ state.validation }}</p>
          <p v-if="!online" class="help-note" role="status">{{ t('当前离线。可以先保留草稿，联网后手动提交。', 'You are offline. Keep your draft and submit it manually when connected.') }}</p>
          <p v-if="state.busy" class="help-note" role="status">{{ t('正在提交…关闭页面时会保留未确认的草稿。', 'Sending… Closing this page will keep an unconfirmed draft.') }}</p>
          <div v-if="state.outcome === 'sent'" class="help-success" role="status"><p>{{ t('服务器已确认收到反馈，谢谢你。', 'The server confirmed receipt of your feedback. Thank you.') }}</p><p v-if="state.localSaved === false">{{ t('本机状态未能保存，请勿重复提交。', 'The local status could not be saved. Please do not submit it again.') }}</p></div>
          <div v-if="!state.busy && (state.outcome === 'failed' || (state.unconfirmed && state.outcome !== 'sent'))" class="help-warning" role="status"><p>{{ t('尚未收到服务器成功确认。草稿不会自动重发，你可以手动重试。', 'No success confirmation has been received. Your draft will not be resent automatically; you can retry manually.') }}</p><p>{{ t('网络中断也可能发生在送达之后，重试可能产生重复反馈。', 'A connection can be lost after delivery, so retrying may send the same feedback twice.') }}</p></div>
          <p v-if="hasDraft && state.localSaved === true && !state.busy" class="help-note" role="status">{{ t('草稿已保存在本机。', 'Your draft is saved on this device.') }}</p><p v-else-if="hasDraft && state.localSaved === false && state.outcome !== 'sent'" class="help-warning" role="status">{{ t('草稿暂未能保存，内容仍在当前页面。', 'The draft could not be saved. Your content is still on this page.') }}</p>
          <p v-if="lastSentTime && state.outcome !== 'sent'" class="help-note">{{ t('最近一次已确认送达：', 'Last confirmed delivery: ') }}{{ lastSentTime }}</p>
          <footer class="help-actions"><button type="button" class="help-secondary" :disabled="closing" @click="requestClose">{{ closing ? t('正在保存草稿…', 'Saving draft…') : t('保存并关闭', 'Save & close') }}</button><button type="submit" class="help-primary" :disabled="locked || !online">{{ state.busy ? t('正在提交…', 'Sending…') : state.outcome === 'failed' || state.unconfirmed ? t('手动重试', 'Retry manually') : t('提交反馈', 'Send feedback') }}</button></footer>
        </form>
        <div v-if="closeFailure" class="help-close-warning help-warning" role="alert" tabindex="-1"><p>{{ t('草稿未能保存，内容仍在当前页面。可以复制内容后重试，或选择不保存关闭。', 'The draft could not be saved. Your content is still here. You can copy it and retry, or close without saving.') }}</p><button type="button" class="help-text-button" @click="discardAndClose">{{ t('仍然关闭', 'Close without saving') }}</button></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.help-panel-backdrop { position:fixed; inset:0; z-index:92; display:flex; align-items:center; justify-content:center; padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom)); background:#08060dd9; backdrop-filter:blur(8px); }
.help-panel { box-sizing:border-box; display:flex; flex-direction:column; width:100%; max-width:540px; max-height:calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); min-width:0; border:1px solid var(--m-line,#cbb0ed2b); border-radius:24px; background:var(--m-card-surface,#211b29); color:var(--m-text,#f1ecf4); box-shadow:0 24px 90px #0008; outline:none; overflow:hidden; }
.help-panel * { box-sizing:border-box; }
.help-heading { display:flex; flex:none; justify-content:space-between; align-items:flex-start; gap:12px; padding:22px 22px 16px; }
.help-heading p { margin:0 0 4px; color:var(--m-muted,#b6a8c6); font-size:11px; letter-spacing:.16em; }.help-heading h2 { margin:0; font-family:var(--m-heading-font,'Songti SC','SimSun',serif); font-size:24px; line-height:1.5; font-weight:500; }
.help-close { display:grid; place-items:center; width:44px; height:44px; flex:none; margin:-5px -6px 0 0; padding:0; border:1px solid var(--m-line,#cbb0ed2b); border-radius:12px; background:transparent; color:inherit; }
.help-panel :where(button,input,select,textarea) { font:inherit; }.help-panel button,.help-faq summary { cursor:pointer; touch-action:manipulation; }.help-panel button:disabled { opacity:.5; cursor:default; }.help-panel :is(button,input,select,textarea,summary):focus-visible { outline:2px solid var(--m-accent,#cbb0ed); outline-offset:3px; }
.help-tabs { display:flex; flex:none; gap:6px; margin:0 22px 14px; padding:4px; border:1px solid var(--m-line,#cbb0ed2b); border-radius:14px; background:var(--m-bg,#151019); }.help-tabs button { display:flex; align-items:center; justify-content:center; gap:7px; flex:1; min-width:0; min-height:44px; padding:9px; border:0; border-radius:10px; background:transparent; color:var(--m-muted,#b6a8c6); font-size:14px; line-height:1.5; }.help-tabs button[aria-pressed=true] { background:#cbb0ed1a; color:var(--m-text,#f1ecf4); }.help-draft-dot { width:6px; height:6px; border-radius:50%; background:var(--m-accent,#cbb0ed); }
.help-body { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:0 22px 24px; }.help-intro { margin:3px 0 18px; color:var(--m-muted,#b6a8c6); font-size:13px; line-height:1.9; overflow-wrap:anywhere; }.help-faq details { border-top:1px solid var(--m-line,#cbb0ed2b); }.help-faq details:last-of-type { border-bottom:1px solid var(--m-line,#cbb0ed2b); }.help-faq summary { display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:54px; padding:13px 2px; list-style:none; font-size:14px; line-height:1.6; }.help-faq summary::-webkit-details-marker { display:none; }.help-faq summary::after { content:'+'; flex:none; color:var(--m-accent,#cbb0ed); font-size:20px; }.help-faq details[open] summary::after { content:'−'; }.help-faq details p { margin:0 0 17px; color:var(--m-muted,#b6a8c6); font-size:13px; line-height:1.9; overflow-wrap:anywhere; }.help-write { width:100%; margin-top:20px; }
.help-feedback fieldset { margin:0; padding:0; min-width:0; border:0; }.help-feedback label { display:block; margin:18px 0 9px; font-size:13px; line-height:1.6; }.help-feedback fieldset > label:first-child { margin-top:0; }.help-feedback input:not([type=checkbox]),.help-feedback select,.help-feedback textarea { display:block; width:100%; min-width:0; min-height:48px; padding:12px; border:1px solid var(--m-line,#cbb0ed2b); border-radius:12px; background:var(--m-bg,#151019); color:var(--m-text,#f1ecf4); font-size:16px; line-height:1.65; }.help-feedback textarea { min-height:136px; resize:vertical; }.help-feedback select { color-scheme:dark; }.help-feedback input:disabled,.help-feedback textarea:disabled,.help-feedback select:disabled { opacity:.55; }.help-feedback textarea[aria-invalid=true] { border-color:#ffc7c7; }.help-label { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; }.help-label label { margin:0 0 9px; }.help-label > span { flex:none; margin-bottom:9px; color:var(--m-muted,#b6a8c6); font-size:11px; }.help-label > .help-count-over { color:#ffc7c7; }
.help-diagnostics { margin-top:20px; padding-top:2px; border-top:1px solid var(--m-line,#cbb0ed2b); }.help-diagnostics .help-check { display:flex; align-items:flex-start; gap:10px; margin:15px 0 8px; font-size:13px; line-height:1.7; }.help-check input { flex:none; width:18px; height:18px; margin:2px 0 0; accent-color:var(--m-accent,#cbb0ed); }.help-diagnostics p { margin:0; color:var(--m-muted,#b6a8c6); font-size:11px; line-height:1.8; overflow-wrap:anywhere; }
.help-note,.help-error,.help-warning,.help-success { margin:14px 0 0; font-size:12px; line-height:1.85; overflow-wrap:anywhere; }.help-note { color:var(--m-muted,#b6a8c6); }.help-error { color:#ffc7c7; }.help-warning { color:#ead3a7; }.help-success { color:#c4decf; }.help-warning p,.help-error p,.help-success p { margin:0; }.help-warning p+p,.help-success p+p { margin-top:6px; }.help-actions { display:grid; grid-template-columns:1fr 1.2fr; gap:10px; margin-top:22px; }.help-primary,.help-secondary { min-height:48px; padding:11px 14px; border:1px solid var(--m-line,#cbb0ed2b); border-radius:12px; color:inherit; font-size:14px; line-height:1.5; }.help-primary { border-color:transparent; background:var(--m-accent,#cbb0ed); color:var(--m-button-text,#24192d); font-weight:600!important; }.help-secondary { background:transparent; }.help-text-button { min-height:44px; padding:8px 0; border:0; background:transparent; color:inherit; text-decoration:underline; text-underline-offset:4px; font-size:12px; }.help-close-warning { padding:14px; border:1px solid #ead3a733; border-radius:12px; outline:none; }
@media(max-width:360px) { .help-panel-backdrop { padding-inline:12px; }.help-heading { padding:18px 18px 14px; }.help-heading h2 { font-size:22px; }.help-tabs { margin-inline:18px; }.help-body { padding-inline:18px; }.help-actions { gap:8px; }.help-actions button { padding-inline:9px; } }
</style>
