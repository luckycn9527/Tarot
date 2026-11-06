<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import XIcon from '@icons/x.vue'
import {
  changeMobilePassword, deleteMobileAccount, mobileError, registerMobileAccount,
  requestMobilePasswordReset, sendMobileRegistrationCode,
} from '../mobileApi'
import {
  accountAccessIssue, accountEmailIssue, beginAccountAccessRequest, createAccountAccessState,
  finishAccountAccessRequest, registrationAccountPayload, registrationCodeSeconds,
  type AccountAccessFields, type AccountAccessIssue, type MobileAccountAccessMode,
} from '../mobileAccountAccessModel'

const props = defineProps<{ mode: MobileAccountAccessMode; english: boolean; online: boolean; email?: string }>()
const emit = defineEmits<{ close: []; signin: [identifier: string]; 'session-ended': [] }>()
const t = (zh: string, en: string) => props.english ? en : zh
const dialog = ref<HTMLElement | null>(null), resultPanel = ref<HTMLElement | null>(null)
const fields = reactive<AccountAccessFields>({ email: props.email || '', emailCode: '', nickname: '', password: '', repeatPassword: '', oldPassword: '', deleteConfirmed: false })
const state = reactive(createAccountAccessState())
const issue = ref<AccountAccessIssue | null>(null), error = ref(''), codeNotice = ref(''), now = ref(Date.now())
const busy = computed(() => Boolean(state.pending))
const completed = computed(() => state.result !== 'editing')
const cooldown = computed(() => registrationCodeSeconds(state.codeAvailableAt, now.value))
const title = computed(() => ({
  register: t('注册账号', 'Create account'), forgot: t('找回密码', 'Reset password'),
  password: t('修改密码', 'Change password'), delete: t('注销账号', 'Delete account'),
})[props.mode])
const actionLabel = computed(() => ({
  register: t('注册账号', 'Create account'), forgot: t('发送重置邮件', 'Send reset email'),
  password: t('保存新密码', 'Save new password'), delete: t('永久注销账号', 'Permanently delete account'),
})[props.mode])
const message = computed(() => issue.value?.message || error.value)
const previousFocus = document.activeElement as HTMLElement | null
let previousOverflow = '', timer: ReturnType<typeof setInterval> | undefined, disposed = false, signinEmitted = false

function changed() { issue.value = null; error.value = '' }
function close() { if (!busy.value) emit('close') }
defineExpose({ requestClose: close })
function inputId(field: keyof AccountAccessFields) { return `account-access-${field}` }
async function showIssue(value: AccountAccessIssue) {
  issue.value = value
  await nextTick()
  dialog.value?.querySelector<HTMLElement>(`#${inputId(value.field)}`)?.focus()
}
async function showResult() { await nextTick(); resultPanel.value?.focus() }
function offline() {
  if (props.online) return false
  error.value = t('当前处于离线状态，连接网络后再试。', 'You are offline. Reconnect and try again.')
  return true
}
async function sendCode() {
  if (busy.value || completed.value || cooldown.value || offline()) return
  changed(); codeNotice.value = ''
  const emailError = accountEmailIssue(fields.email, props.english)
  if (emailError) { await showIssue(emailError); return }
  if (!beginAccountAccessRequest(state, 'code', props.online)) return
  try {
    await sendMobileRegistrationCode(fields.email.trim())
    if (disposed) return
    now.value = Date.now(); state.codeAvailableAt = now.value + 60_000
    codeNotice.value = t(`验证码已发送至 ${fields.email.trim()}，请查看收件箱和垃圾邮件。`, `Code sent to ${fields.email.trim()}. Check your inbox and spam folder.`)
  } catch (failure) {
    if (!disposed) error.value = mobileError(failure, t('验证码发送失败，请稍后重试。', 'Could not send the code. Try again later.'))
  } finally { if (!disposed) finishAccountAccessRequest(state) }
}
async function submit() {
  if (busy.value || completed.value || offline()) return
  changed()
  const validation = accountAccessIssue(props.mode, fields, props.english)
  if (validation) { await showIssue(validation); return }
  if (!beginAccountAccessRequest(state, 'submit', props.online)) return
  try {
    if (props.mode === 'register') {
      await registerMobileAccount(registrationAccountPayload(fields))
      if (disposed) return
      finishAccountAccessRequest(state, 'registered')
      fields.password = ''; fields.repeatPassword = ''; fields.emailCode = ''
      await showResult()
    } else if (props.mode === 'forgot') {
      await requestMobilePasswordReset(fields.email.trim())
      if (disposed) return
      finishAccountAccessRequest(state, 'reset-sent'); await showResult()
    } else {
      if (props.mode === 'password') await changeMobilePassword(fields.oldPassword, fields.password)
      else await deleteMobileAccount(fields.password)
      if (disposed) return
      fields.password = ''; fields.repeatPassword = ''; fields.oldPassword = ''
      if (finishAccountAccessRequest(state, 'session-ended')) emit('session-ended')
    }
  } catch (failure) {
    if (!disposed) error.value = mobileError(failure, t('操作失败，请稍后重试。', 'This request failed. Try again later.'))
  } finally { if (!disposed) finishAccountAccessRequest(state) }
}
function signIn() {
  if (state.result !== 'registered' || signinEmitted) return
  signinEmitted = true; emit('signin', fields.email.trim())
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href],[tabindex="0"]')).filter(node => node.getClientRects().length)
  const first = focusable[0], last = focusable[focusable.length - 1]
  if (!first || !last) { event.preventDefault(); dialog.value.focus(); return }
  if (!dialog.value.contains(document.activeElement) || document.activeElement === dialog.value) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => props.online, () => { if (props.online) error.value = '' })
onMounted(async () => {
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', keydown)
  timer = setInterval(() => { now.value = Date.now() }, 1000)
  await nextTick(); dialog.value?.focus()
})
onBeforeUnmount(() => {
  disposed = true; if (timer) clearInterval(timer)
  document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown)
  fields.password = ''; fields.repeatPassword = ''; fields.oldPassword = ''
  if (previousFocus?.isConnected) previousFocus.focus()
})
</script>

<template>
  <div class="account-access-backdrop" @click.self="close">
    <section ref="dialog" class="account-access" role="dialog" aria-modal="true" aria-labelledby="account-access-title" :aria-busy="busy" tabindex="-1">
      <header><div><p>E-Tomd</p><h2 id="account-access-title">{{ title }}</h2></div><button class="account-access-close" type="button" :disabled="busy" :aria-label="t('关闭', 'Close')" @click="close"><XIcon :size="22" /></button></header>

      <div v-if="completed" ref="resultPanel" class="account-access-result" role="status" tabindex="-1">
        <template v-if="state.result === 'registered'">
          <h3>{{ t('注册成功', 'Account created') }}</h3>
          <p>{{ t('你的账号已创建。请使用注册邮箱和密码登录。', 'Your account is ready. Sign in with your email and password.') }}</p>
          <p class="account-access-email">{{ fields.email.trim() }}</p>
          <button class="account-access-primary" type="button" @click="signIn">{{ t('前往登录', 'Sign in') }}</button>
        </template>
        <template v-else-if="state.result === 'reset-sent'">
          <h3>{{ t('请查看邮箱', 'Check your email') }}</h3>
          <p>{{ t('如果该邮箱已注册，你将收到密码重置邮件。请查看收件箱和垃圾邮件，并在邮件打开的网站页面中设置新密码，然后返回 App 登录。', 'If this email is registered, you will receive a password reset email. Check your inbox and spam folder. Set a new password on the website opened by the email link, then return to this app to sign in.') }}</p>
          <p class="account-access-email">{{ fields.email.trim() }}</p>
          <button class="account-access-primary" type="button" @click="close">{{ t('知道了', 'Done') }}</button>
        </template>
        <template v-else><p>{{ mode === 'delete' ? t('账号已注销。', 'Your account has been deleted.') : t('密码已修改，请重新登录。', 'Password changed. Please sign in again.') }}</p><button class="account-access-primary" type="button" @click="close">{{ t('关闭', 'Close') }}</button></template>
      </div>

      <form v-else novalidate @submit.prevent="submit">
        <p v-if="mode === 'register'" class="account-access-note">{{ t('使用邮箱验证码创建账号，注册后需要自行登录。', 'Create an account with an email code, then sign in.') }}</p>
        <p v-else-if="mode === 'forgot'" class="account-access-note">{{ t('输入注册邮箱，我们会发送安全重置链接。请在邮件打开的网站页面中完成密码重置。', 'Enter your registered email to request a secure reset link. Complete the password reset on the website opened by the email.') }}</p>
        <p v-else-if="mode === 'password'" class="account-access-note">{{ t('修改成功后将退出当前账号，请使用新密码重新登录。', 'After saving, you will be signed out. Sign in again with your new password.') }}</p>
        <div v-else class="account-access-warning"><strong>{{ t('注销后无法恢复', 'Account deletion is permanent') }}</strong><p>{{ t('你的账号及关联数据将被删除，无法再使用此账号登录。请确认已保存需要保留的信息。', 'Your account and associated data will be deleted, and you will lose access to this account. Save any information you need before continuing.') }}</p></div>
        <p v-if="!online" class="account-access-offline" role="status">{{ t('当前离线，连接网络后即可操作。', 'You are offline. Reconnect to continue.') }}</p>
        <fieldset :disabled="busy">
          <div v-if="mode === 'register' || mode === 'forgot'" class="account-access-field">
            <label :for="inputId('email')">{{ t('邮箱', 'Email') }}</label>
            <input :id="inputId('email')" v-model="fields.email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" :spellcheck="false" maxlength="254" required :aria-invalid="issue?.field === 'email'" :aria-describedby="message ? 'account-access-message' : undefined" @input="changed">
          </div>
          <template v-if="mode === 'register'">
            <div class="account-access-field"><label :for="inputId('emailCode')">{{ t('邮箱验证码', 'Email code') }}</label><div class="account-access-code-row"><input :id="inputId('emailCode')" v-model="fields.emailCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required :aria-invalid="issue?.field === 'emailCode'" :aria-describedby="message ? 'account-access-message' : undefined" @input="changed"><button type="button" :disabled="!online || busy || cooldown > 0" @click="sendCode">{{ state.pending === 'code' ? t('发送中…', 'Sending…') : cooldown ? t(`${cooldown}秒后重发`, `Resend in ${cooldown}s`) : t('发送验证码', 'Send code') }}</button></div><p v-if="codeNotice" class="account-access-hint" role="status">{{ codeNotice }}</p></div>
            <div class="account-access-field"><label :for="inputId('nickname')">{{ t('昵称', 'Nickname') }} <span>{{ t('2–20个字符', '2–20 characters') }}</span></label><input :id="inputId('nickname')" v-model="fields.nickname" type="text" autocomplete="nickname" minlength="2" maxlength="20" required :aria-invalid="issue?.field === 'nickname'" :aria-describedby="message ? 'account-access-message' : undefined" @input="changed"></div>
          </template>
          <div v-if="mode === 'password'" class="account-access-field"><label :for="inputId('oldPassword')">{{ t('当前密码', 'Current password') }}</label><input :id="inputId('oldPassword')" v-model="fields.oldPassword" type="password" autocomplete="current-password" maxlength="100" required :aria-invalid="issue?.field === 'oldPassword'" :aria-describedby="message ? 'account-access-message' : undefined" @input="changed"></div>
          <template v-if="mode !== 'forgot'">
            <div class="account-access-field"><label :for="inputId('password')">{{ mode === 'delete' ? t('当前密码', 'Current password') : mode === 'password' ? t('新密码', 'New password') : t('密码', 'Password') }} <span v-if="mode !== 'delete'">{{ t('6–50个字符', '6–50 characters') }}</span></label><input :id="inputId('password')" v-model="fields.password" type="password" :autocomplete="mode === 'delete' ? 'current-password' : 'new-password'" :maxlength="mode === 'delete' ? 100 : 50" :minlength="mode === 'delete' ? 1 : 6" required :aria-invalid="issue?.field === 'password'" :aria-describedby="message ? 'account-access-message' : undefined" @input="changed"></div>
            <div v-if="mode !== 'delete'" class="account-access-field"><label :for="inputId('repeatPassword')">{{ t('确认密码', 'Confirm password') }}</label><input :id="inputId('repeatPassword')" v-model="fields.repeatPassword" type="password" autocomplete="new-password" maxlength="50" required :aria-invalid="issue?.field === 'repeatPassword'" :aria-describedby="message ? 'account-access-message' : undefined" @input="changed"></div>
          </template>
          <label v-if="mode === 'delete'" class="account-access-confirm" :for="inputId('deleteConfirmed')"><input :id="inputId('deleteConfirmed')" v-model="fields.deleteConfirmed" type="checkbox" :aria-invalid="issue?.field === 'deleteConfirmed'" :aria-describedby="message ? 'account-access-message' : undefined" @change="changed"><span>{{ t('我已了解账号及关联数据将被永久删除，并确认注销。', 'I understand that my account and associated data will be permanently deleted, and confirm deletion.') }}</span></label>
        </fieldset>
        <p v-if="message" id="account-access-message" class="account-access-error" role="alert">{{ message }}</p>
        <footer><button class="account-access-cancel" type="button" :disabled="busy" @click="close">{{ t('取消', 'Cancel') }}</button><button :class="mode === 'delete' ? 'account-access-danger' : 'account-access-primary'" type="submit" :disabled="busy || !online || (mode === 'delete' && !fields.deleteConfirmed)">{{ state.pending === 'submit' ? t('处理中…', 'Working…') : actionLabel }}</button></footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
.account-access-backdrop { position: fixed; inset: 0; z-index: 95; display: flex; align-items: center; justify-content: center; padding: max(18px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom)); overflow-y: auto; overscroll-behavior: contain; background: #08060dcc; backdrop-filter: blur(8px); }
.account-access { box-sizing: border-box; width: 100%; max-width: 430px; max-height: calc(100dvh - 36px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); min-width: 0; overflow-y: auto; padding: 24px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 24px; outline: none; background: var(--m-card-surface, #211b29); color: var(--m-text, #f1ecf4); box-shadow: 0 24px 90px #0008; }
.account-access header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
.account-access header p { margin: 0 0 4px; color: var(--m-muted, #b6a8c6); font-size: 11px; letter-spacing: .16em; }
.account-access h2 { margin: 0; font-family: var(--m-heading-font, 'Songti SC', 'SimSun', serif); font-size: 23px; line-height: 1.5; font-weight: 500; }
.account-access :where(button) { min-height: 44px; font: inherit; cursor: pointer; touch-action: manipulation; }
.account-access button:disabled { opacity: .5; cursor: default; }
.account-access :is(input, button):focus-visible, .account-access-result:focus-visible { outline: 2px solid var(--m-accent, #cbb0ed); outline-offset: 3px; }
.account-access-close { display: grid; place-items: center; flex: none; width: 44px; height: 44px; margin: -7px -8px 0 0; padding: 0; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: transparent; color: var(--m-text, #f1ecf4); }
.account-access-note, .account-access-result p { margin: 0 0 20px; color: var(--m-muted, #b6a8c6); font-size: 13px; line-height: 1.9; overflow-wrap: anywhere; }
.account-access fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
.account-access-field { margin-bottom: 16px; }
.account-access-field > label { display: block; margin-bottom: 9px; font-size: 13px; line-height: 1.7; }
.account-access-field label span { margin-left: 5px; color: var(--m-muted, #b6a8c6); font-size: 11px; }
.account-access-field input { display: block; box-sizing: border-box; width: 100%; min-width: 0; min-height: 48px; padding: 10px 12px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: var(--m-bg, #151019); color: var(--m-text, #f1ecf4); font: inherit; font-size: 16px; }
.account-access input[aria-invalid=true] { border-color: #ed9caa; }
.account-access input:disabled { opacity: .6; }
.account-access-code-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(110px, .95fr); gap: 10px; }
.account-access-code-row button { padding: 8px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: transparent; color: var(--m-accent, #cbb0ed); font-size: 12px; line-height: 1.5; }
.account-access-hint { margin: 8px 0 0; color: var(--m-muted, #b6a8c6); font-size: 11px; line-height: 1.8; }
.account-access-error, .account-access-offline { margin: 15px 0 0; color: #ffc7c7; font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
.account-access-offline { margin: 0 0 16px; }
.account-access-warning { margin-bottom: 20px; padding: 14px; border: 1px solid #ef9eaa55; border-radius: 14px; background: #e4758a0c; color: #ffd0d8; }
.account-access-warning strong { font-size: 14px; font-weight: 600; }
.account-access-warning p { margin: 8px 0 0; font-size: 12px; line-height: 1.9; overflow-wrap: anywhere; }
.account-access-confirm { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; padding-block: 8px; color: var(--m-muted, #b6a8c6); font-size: 12px; line-height: 1.9; cursor: pointer; }
.account-access-confirm input { flex: none; width: 18px; height: 18px; margin: 3px 0 0; accent-color: #ed9caa; }
.account-access footer { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.6fr); gap: 12px; margin-top: 24px; }
.account-access footer button, .account-access-result > button { min-height: 48px; padding: 11px 12px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.account-access-cancel { background: transparent; color: var(--m-text, #f1ecf4); }
.account-access-primary { border-color: transparent !important; background: var(--m-accent, #cbb0ed); color: var(--m-accent-ink, #291d35); font-weight: 600 !important; }
.account-access-danger { border-color: #ef9eaa66 !important; background: #65303f; color: #ffe2e6; font-weight: 600 !important; }
.account-access-result { outline: none; }
.account-access-result h3 { margin: 0 0 12px; font-size: 18px; font-weight: 500; }
.account-access-result .account-access-email { color: var(--m-text, #f1ecf4); }
.account-access-result > button { width: 100%; }
@media (max-height: 600px) { .account-access-backdrop { align-items: flex-start; padding-block: 12px; } .account-access { max-height: calc(100dvh - 24px); padding: 20px; } .account-access header { margin-bottom: 15px; } .account-access-note { margin-bottom: 14px; } }
@media (prefers-reduced-motion: reduce) { .account-access-backdrop { backdrop-filter: none; } }
</style>
