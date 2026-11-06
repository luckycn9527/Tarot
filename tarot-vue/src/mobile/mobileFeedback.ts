import { FEEDBACK_LIMITS } from '../utils/feedbackSubmission'

export const MOBILE_FEEDBACK_TYPES = ['bug', 'feature', 'other', 'complaint'] as const
export type MobileFeedbackType = typeof MOBILE_FEEDBACK_TYPES[number]
export interface MobileFeedbackDiagnostics {
  version: string; versionCode: number; platform: 'android' | 'ios' | 'web'; osVersion: string; locale: 'zh-CN' | 'en-US'
}
export interface MobileFeedbackPayload { type: MobileFeedbackType; content: string; contact?: string }
export interface MobileFeedbackDraft {
  schema: 1; owner: number | null; type: MobileFeedbackType; content: string; contact: string
  includeDiagnostics: boolean; errorCode: string; unconfirmed: boolean; lastSentAt: string | null
}
export function createMobileFeedbackState() {
  return { type: 'bug' as MobileFeedbackType, content: '', contact: '', includeDiagnostics: false, errorCode: '',
    loading: true, busy: false, outcome: 'idle' as 'idle' | 'sent' | 'failed' | 'offline',
    localSaved: null as boolean | null, loadError: false, validation: null as string | null,
    validationField: null as 'type' | 'content' | 'contact' | 'errorCode' | null,
    lastSentAt: null as string | null, unconfirmed: false }
}
export type MobileFeedbackState = ReturnType<typeof createMobileFeedbackState>
const validOwner = (owner: number | null) => owner === null || Number.isSafeInteger(owner) && owner > 0
export function mobileFeedbackStorageKey(owner: number | null) {
  if (!validOwner(owner)) throw new Error('Invalid feedback owner')
  return `feedback-draft-${owner ?? 'guest'}`
}
export function createMobileFeedbackDiagnostics(input: { version: string; versionCode: number; platform: string; userAgent: string; english: boolean }): MobileFeedbackDiagnostics {
  const platform = input.platform === 'android' || input.platform === 'ios' ? input.platform : 'web'
  const version = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(input.version) ? input.version : 'unknown'
  const versionCode = Number.isSafeInteger(input.versionCode) && input.versionCode > 0 && input.versionCode <= 2_100_000_000 ? input.versionCode : 0
  const os = platform === 'android' ? input.userAgent.match(/Android ([0-9.]{1,20})/)?.[1]
    : platform === 'ios' ? input.userAgent.match(/(?:iPhone |CPU )OS ([0-9_]{1,20})/)?.[1]?.replace(/_/g, '.') : undefined
  return { version, versionCode, platform, osVersion: os ? `${platform === 'android' ? 'Android' : 'iOS'} ${os}` : 'unknown', locale: input.english ? 'en-US' : 'zh-CN' }
}
function diagnosticText(diagnostics: MobileFeedbackDiagnostics, errorCode: string) {
  // Rebuild a whitelist even when a caller supplies an object containing other fields.
  const d = createMobileFeedbackDiagnostics({ ...diagnostics, userAgent: diagnostics.platform === 'android' ? diagnostics.osVersion
    : diagnostics.platform === 'ios' ? `CPU OS ${diagnostics.osVersion.replace(/^iOS /, '').replace(/\./g, '_')}` : '', english: diagnostics.locale === 'en-US' })
  return ['[APP diagnostics]', `App: E-Tomd ${d.version} (${d.versionCode})`, `Platform: ${d.platform}`, `OS: ${d.osVersion}`, `Locale: ${d.locale}`,
    ...(/^[A-Za-z0-9_-]{1,64}$/.test(errorCode.trim()) ? [`Error: ${errorCode.trim()}`] : [])].join('\n')
}
export function mobileFeedbackContentLimit(state: Pick<MobileFeedbackState, 'includeDiagnostics' | 'errorCode'>, diagnostics: MobileFeedbackDiagnostics) {
  return FEEDBACK_LIMITS.maxContent - (state.includeDiagnostics ? diagnosticText(diagnostics, state.errorCode).length + 2 : 0)
}
function snapshot(state: MobileFeedbackState, owner: number | null): MobileFeedbackDraft {
  return { schema: 1, owner, type: state.type, content: state.content, contact: state.contact,
    includeDiagnostics: state.includeDiagnostics, errorCode: state.errorCode, unconfirmed: state.unconfirmed, lastSentAt: state.lastSentAt }
}
export function normalizeMobileFeedbackDraft(value: unknown, owner: number | null): MobileFeedbackDraft | null {
  if (!value || typeof value !== 'object' || !validOwner(owner)) return null
  const d = value as MobileFeedbackDraft
  if (d.schema !== 1 || d.owner !== owner || !MOBILE_FEEDBACK_TYPES.includes(d.type) || typeof d.content !== 'string' || d.content.length > FEEDBACK_LIMITS.maxContent ||
    typeof d.contact !== 'string' || d.contact.length > FEEDBACK_LIMITS.maxContact || typeof d.errorCode !== 'string' || d.errorCode.length > 64 ||
    typeof d.includeDiagnostics !== 'boolean' || typeof d.unconfirmed !== 'boolean' ||
    (d.lastSentAt !== null && (typeof d.lastSentAt !== 'string' || d.lastSentAt.length > 40 || !Number.isFinite(Date.parse(d.lastSentAt))))) return null
  // Do not carry arbitrary stored properties into the form or a request.
  return { schema: 1, owner, type: d.type, content: d.content, contact: d.contact, includeDiagnostics: d.includeDiagnostics,
    errorCode: d.errorCode, unconfirmed: d.unconfirmed, lastSentAt: d.lastSentAt }
}
interface MobileFeedbackDependencies {
  owner: number | null
  isCurrentOwner: () => boolean
  connected: () => boolean
  read: () => Promise<unknown>
  write: (draft: MobileFeedbackDraft) => Promise<void>
  send: (payload: MobileFeedbackPayload) => Promise<unknown>
  diagnostics: () => MobileFeedbackDiagnostics
  english: () => boolean
  now?: () => string
}

export function createMobileFeedbackController(state: MobileFeedbackState, dependencies: MobileFeedbackDependencies) {
  mobileFeedbackStorageKey(dependencies.owner)
  let active = true, revision = 0, loadSequence = 0
  const current = () => active && dependencies.isCurrentOwner()
  const t = (zh: string, en: string) => dependencies.english() ? en : zh
  function edit() { if (!current() || state.busy) return; revision++; state.outcome = 'idle'; state.localSaved = null; state.validation = null; state.validationField = null }
  async function load() {
    const sequence = ++loadSequence
    state.loading = true; state.loadError = false
    try {
      const raw = await dependencies.read()
      if (!current() || sequence !== loadSequence) return
      const draft = normalizeMobileFeedbackDraft(raw, dependencies.owner)
      if (draft) {
        Object.assign(state, { type: draft.type, content: draft.content, contact: draft.contact, includeDiagnostics: draft.includeDiagnostics,
          errorCode: draft.errorCode, unconfirmed: draft.unconfirmed, lastSentAt: draft.lastSentAt })
        state.localSaved = true
      }
    } catch { if (current() && sequence === loadSequence) state.loadError = true }
    finally { if (current() && sequence === loadSequence) state.loading = false }
  }
  async function saveDraft() {
    if (!current() || state.loading || state.loadError) return false
    const version = revision, draft = snapshot(state, dependencies.owner)
    let saved = false
    try {
      await dependencies.write(draft)
      if (!current()) return false
      const stored = normalizeMobileFeedbackDraft(await dependencies.read(), dependencies.owner)
      saved = stored !== null && JSON.stringify(stored) === JSON.stringify(draft)
    } catch { /* Keep the visible text and never claim that failed storage saved it. */ }
    if (current() && version === revision) state.localSaved = saved
    return saved && current() && version === revision
  }
  function validation() {
    state.validationField = null
    const invalid = (field: MobileFeedbackState['validationField'], zh: string, en: string) => { state.validationField = field; return t(zh, en) }
    const content = state.content.trim(), limit = mobileFeedbackContentLimit(state, dependencies.diagnostics())
    if (!MOBILE_FEEDBACK_TYPES.includes(state.type)) return invalid('type', '请选择反馈类型。', 'Choose a feedback type.')
    if (content.length < FEEDBACK_LIMITS.minContent || content.length > limit) return invalid('content', `请输入 ${FEEDBACK_LIMITS.minContent}–${limit} 个字${state.includeDiagnostics ? '，附带的诊断信息会计入总长度' : ''}。`, `Enter ${FEEDBACK_LIMITS.minContent}–${limit} characters${state.includeDiagnostics ? '; diagnostic details count toward the total' : ''}.`)
    if (state.contact.trim().length > FEEDBACK_LIMITS.maxContact) return invalid('contact', '联系方式不能超过 100 个字符。', 'Contact details must be at most 100 characters.')
    if (state.includeDiagnostics && state.errorCode.trim() && !/^[A-Za-z0-9_-]{1,64}$/.test(state.errorCode.trim())) return invalid('errorCode', '错误编号只能包含字母、数字、短横线或下划线，最多 64 个字符。', 'Use up to 64 letters, numbers, hyphens or underscores for the error code.')
    return null
  }
  async function submit() {
    if (!current()) return 'stale' as const
    if (state.busy) return 'busy' as const
    if (state.loading || state.loadError) return 'notReady' as const
    state.validation = validation()
    if (state.validation) return 'invalid' as const
    if (!dependencies.connected()) { state.outcome = 'offline'; await saveDraft(); return 'offline' as const }
    const previousUnconfirmed = state.unconfirmed
    state.busy = true; state.outcome = 'idle'; state.unconfirmed = true; revision++
    const payload: MobileFeedbackPayload = { type: state.type, content: state.content.trim() + (state.includeDiagnostics ? `\n\n${diagnosticText(dependencies.diagnostics(), state.errorCode)}` : ''),
      ...(state.contact.trim() ? { contact: state.contact.trim() } : {}) }
    if (payload.content.length > FEEDBACK_LIMITS.maxContent) {
      state.busy = false; state.unconfirmed = previousUnconfirmed
      state.validationField = 'content'
      state.validation = t('附带诊断后内容过长，请缩短正文。', 'The feedback and diagnostic details are too long. Shorten your message.')
      return 'invalid' as const
    }
    await saveDraft()
    if (!current()) return 'stale' as const
    if (!dependencies.connected()) { state.busy = false; state.unconfirmed = previousUnconfirmed; state.outcome = 'offline'; revision++; await saveDraft(); return 'offline' as const }
    try {
      const response = await dependencies.send(payload)
      if (!response || typeof response !== 'object' || !('success' in response) || response.success !== true) throw new Error('Feedback not confirmed')
    } catch (error) {
      if (!current() || (error instanceof Error && error.name === 'MobileSessionChangedError')) return 'stale' as const
      state.outcome = 'failed'; state.busy = false
      await saveDraft()
      return current() ? 'failed' as const : 'stale' as const
    }
    if (!current()) return 'stale' as const
    revision++; state.content = ''; state.contact = ''; state.errorCode = ''; state.includeDiagnostics = false; state.unconfirmed = false
    state.lastSentAt = dependencies.now?.() ?? new Date().toISOString(); state.outcome = 'sent'; state.busy = false
    await saveDraft()
    return current() ? 'sent' as const : 'stale' as const
  }
  function dispose() { active = false; revision++; loadSequence++ }
  return { load, saveDraft, submit, edit, dispose }
}
