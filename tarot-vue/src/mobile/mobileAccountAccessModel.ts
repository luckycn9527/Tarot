export type MobileAccountAccessMode = 'register' | 'forgot' | 'password' | 'delete'
export type AccountAccessAction = 'code' | 'submit'
export type AccountAccessResult = 'editing' | 'registered' | 'reset-sent' | 'session-ended'
export interface AccountAccessFields {
  email: string
  emailCode: string
  nickname: string
  password: string
  repeatPassword: string
  oldPassword: string
  deleteConfirmed: boolean
}
export interface AccountAccessIssue { field: keyof AccountAccessFields; message: string }
export interface AccountAccessState {
  pending: AccountAccessAction | null
  result: AccountAccessResult
  codeAvailableAt: number
}

export function createAccountAccessState(): AccountAccessState {
  return { pending: null, result: 'editing', codeAvailableAt: 0 }
}

export function registrationCodeSeconds(availableAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((availableAt - now) / 1000))
}

/** One lock covers all requests so a code send cannot overlap registration. */
export function beginAccountAccessRequest(state: AccountAccessState, action: AccountAccessAction, online: boolean, now = Date.now()): boolean {
  if (!online || state.pending || state.result !== 'editing') return false
  if (action === 'code' && registrationCodeSeconds(state.codeAvailableAt, now)) return false
  state.pending = action
  return true
}

/** Returns true only for the first successful transition to a terminal result. */
export function finishAccountAccessRequest(state: AccountAccessState, result?: Exclude<AccountAccessResult, 'editing'>): boolean {
  state.pending = null
  if (!result || state.result !== 'editing') return false
  state.result = result
  return true
}

export function accountEmailIssue(email: string, english = false): AccountAccessIssue | null {
  const value = email.trim()
  if (!value || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { field: 'email', message: english ? 'Enter a valid email address.' : '请输入有效的邮箱地址。' }
  }
  return null
}

export function accountAccessIssue(mode: MobileAccountAccessMode, fields: AccountAccessFields, english = false): AccountAccessIssue | null {
  const issue = (field: keyof AccountAccessFields, zh: string, en: string): AccountAccessIssue => ({ field, message: english ? en : zh })
  if (mode === 'register' || mode === 'forgot') {
    const emailError = accountEmailIssue(fields.email, english)
    if (emailError) return emailError
  }
  if (mode === 'forgot') return null
  if (mode === 'register') {
    if (!/^\d{6}$/.test(fields.emailCode.trim())) return issue('emailCode', '请输入6位数字邮箱验证码。', 'Enter the 6-digit email code.')
    const nickname = fields.nickname.trim()
    if (nickname.length < 2 || nickname.length > 20) return issue('nickname', '昵称需为2–20个字符。', 'Use a nickname with 2–20 characters.')
  }
  if (mode === 'delete') {
    if (!fields.deleteConfirmed) return issue('deleteConfirmed', '请先确认你已了解注销后果。', 'Confirm that you understand account deletion.')
    if (!fields.password || fields.password.length > 100) return issue('password', '请输入当前密码（最多100个字符）。', 'Enter your current password (up to 100 characters).')
    return null
  }
  if (mode === 'password' && (!fields.oldPassword || fields.oldPassword.length > 100)) return issue('oldPassword', '请输入当前密码（最多100个字符）。', 'Enter your current password (up to 100 characters).')
  if (fields.password.length < 6 || fields.password.length > 50) return issue('password', '密码需为6–50个字符。', 'Use a password with 6–50 characters.')
  if (mode === 'password' && fields.password === fields.oldPassword) return issue('password', '新密码不能与当前密码相同。', 'Choose a password different from your current password.')
  if (fields.password !== fields.repeatPassword) return issue('repeatPassword', '两次输入的密码不一致。', 'The passwords do not match.')
  return null
}

export function registrationAccountPayload(fields: AccountAccessFields) {
  return { email: fields.email.trim(), emailCode: fields.emailCode.trim(), nickname: fields.nickname.trim(), password: fields.password }
}
