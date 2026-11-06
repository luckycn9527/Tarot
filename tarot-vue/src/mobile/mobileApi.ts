import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { shallowRef } from 'vue'
import type { User } from '@/stores/auth'
import type { HistoryPage, ReadingHistoryEntry } from '@/stores/readingHistory'
import { readMobileValue, writeMobileValue, mobileSite } from './mobileStorage'
import type { MobileReadingPayload, MobileFollowupPayload, MobileTask } from './types'
import { mergeMobileQuota, validMobileRedemption, type MobileRedemption } from './mobileMembershipModel'

const explicitBase = import.meta.env.VITE_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '')
const explicitOrigin = import.meta.env.VITE_PUBLIC_API_ORIGIN?.trim().replace(/\/+$/, '')
export const mobileApiBase = import.meta.env.PROD ? explicitBase || (explicitOrigin ? `${explicitOrigin}/api` : '/api') : '/api'
export const mobileWebsiteOrigin = explicitOrigin || (explicitBase?.startsWith('https://') ? new URL(explicitBase).origin : window.location.origin)
interface Session { user: User; accessToken: string; refreshToken: string; site: string; sessionExpiresAt?: string }
type MobileRequest = InternalAxiosRequestConfig & { _mobileEpoch?: number; _retried?: boolean }
export const mobileUser = shallowRef<User | null>(null)
export const mobileSessionReady = shallowRef(false)
let session: Session | null = null, epoch = 0, profileRevision = 0
let refreshing: Promise<void> | null = null
const anonymous = axios.create({ baseURL: mobileApiBase, timeout: 20_000, withCredentials: false })
export const mobileApi = axios.create({ baseURL: mobileApiBase, timeout: 20_000, withCredentials: false })

class MobileSessionChangedError extends Error { constructor() { super('Account changed. Please try again.'); this.name = 'MobileSessionChangedError' } }
function validSession(value: unknown): value is Session {
  const saved = value as Session | null
  return !!saved && saved.site === mobileSite && Number.isSafeInteger(saved.user?.id) && typeof saved.accessToken === 'string' && !!saved.accessToken && typeof saved.refreshToken === 'string' && !!saved.refreshToken
}
async function acceptSession(data: Omit<Session, 'site'>, expectedEpoch: number) {
  const next = { ...data, site: mobileSite }
  if (!validSession(next)) throw new Error('Invalid sign-in response')
  if (expectedEpoch !== epoch) throw new MobileSessionChangedError()
  await writeMobileValue('session', next)
  if (expectedEpoch !== epoch) throw new MobileSessionChangedError()
  if (session?.user.id !== next.user.id) epoch++
  session = next; mobileUser.value = next.user
}
export async function refreshMobileSession() {
  if (refreshing) return refreshing
  const current = session, generation = epoch
  if (!current) throw new Error('请先登录')
  refreshing = (async () => {
    try {
      const response = await anonymous.post('/auth/native/refresh', { refreshToken: current.refreshToken })
      if (generation !== epoch) throw new MobileSessionChangedError()
      if (response.data.data?.user?.id !== current.user.id) throw new MobileSessionChangedError()
      await acceptSession(response.data.data, generation)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401 && generation === epoch) await forgetMobileSession()
      throw error
    }
  })().finally(() => { refreshing = null })
  return refreshing
}
mobileApi.interceptors.request.use(config => {
  ;(config as MobileRequest)._mobileEpoch = epoch
  if (session) { config.headers = AxiosHeaders.from(config.headers); config.headers.set('Authorization', `Bearer ${session.accessToken}`) }
  return config
})
mobileApi.interceptors.response.use(response => {
  if ((response.config as MobileRequest)._mobileEpoch !== epoch) throw new MobileSessionChangedError()
  return response
}, async error => {
  if (!axios.isAxiosError(error) || !error.config) throw error
  const config = error.config as MobileRequest
  if (config._mobileEpoch !== epoch) throw new MobileSessionChangedError()
  if (error.response?.status === 401 && session && !config._retried) {
    config._retried = true
    await refreshMobileSession()
    if (config._mobileEpoch !== epoch) throw new MobileSessionChangedError()
    return mobileApi(config)
  }
  throw error
})
export async function initializeMobileSession(connected = navigator.onLine) {
  try {
    const saved = await readMobileValue<Session>('session')
    if (validSession(saved)) { session = saved; mobileUser.value = saved.user; epoch++; if (connected) await refreshMobileProfile() }
  } finally { mobileSessionReady.value = true }
}
export async function loginMobile(identifier: string, password: string) {
  const generation = epoch
  const response = await anonymous.post('/auth/native/login', { identifier: identifier.trim(), password })
  await acceptSession(response.data.data, generation)
}
function confirmedMutation(response: { data: { success?: boolean; message?: string } }) {
  if (response.data?.success !== true) throw new Error(response.data?.message || 'The operation could not be confirmed')
}
export async function sendMobileRegistrationCode(email: string) {
  confirmedMutation(await anonymous.post('/auth/send-register-code', { email: email.trim() }))
}
export async function registerMobileAccount(value: { email: string; emailCode: string; nickname: string; password: string }) {
  confirmedMutation(await anonymous.post('/auth/register', { ...value, email: value.email.trim(), nickname: value.nickname.trim() }))
}
export async function requestMobilePasswordReset(email: string) {
  confirmedMutation(await anonymous.post('/auth/forgot-password', { email: email.trim() }))
}
export async function changeMobilePassword(oldPassword: string, newPassword: string) {
  const generation = epoch
  confirmedMutation(await mobileApi.put('/user/password', { oldPassword, newPassword }))
  if (generation !== epoch) throw new MobileSessionChangedError()
  const token = session?.refreshToken
  if (token) await mobileApi.post('/auth/native/logout', { refreshToken: token }).catch(() => {})
  if (generation !== epoch) throw new MobileSessionChangedError()
  await forgetMobileSession()
}
export async function deleteMobileAccount(password: string) {
  const generation = epoch
  confirmedMutation(await mobileApi.delete('/user/account', { data: { password } }))
  if (generation !== epoch) throw new MobileSessionChangedError()
  await forgetMobileSession()
}
export async function forgetMobileSession() {
  epoch++; session = null; mobileUser.value = null
  await writeMobileValue('session', null)
}
export async function logoutMobile() {
  try {
    if (session) { await refreshMobileSession(); await mobileApi.post('/auth/native/logout', { refreshToken: session?.refreshToken }) }
  } finally { await forgetMobileSession() }
}
export async function refreshMobileProfile() {
  const generation = epoch, revision = profileRevision
  const [profile, quota] = await Promise.allSettled([mobileApi.get('/user/profile'), mobileApi.get('/user/quota')])
  if (profile.status === 'rejected') throw profile.reason
  let user = profile.value.data.data as User
  if (quota.status === 'fulfilled') user = mergeMobileQuota(user, quota.value.data.data)
  if (!session || user.id !== session.user.id) throw new MobileSessionChangedError()
  if (generation !== epoch) throw new MobileSessionChangedError()
  // Returning from the Android picker can start a refresh before an edit saves.
  // A response from that older refresh must never replace the newly saved profile.
  if (revision !== profileRevision) return mobileUser.value!
  session = { ...session, user }; mobileUser.value = user
  await writeMobileValue('session', session)
  return user
}
export interface MobileBirthInfo { birthday: string | null; birthTime: string | null; zodiacSign: string | null }
async function acceptProfileChange(user: User, generation: number, userId: number) {
  if (generation !== epoch || !session || session.user.id !== userId || user.id !== userId) throw new MobileSessionChangedError()
  profileRevision++; session = { ...session, user }; mobileUser.value = user
  await writeMobileValue('session', session)
  if (generation !== epoch || session?.user.id !== userId) throw new MobileSessionChangedError()
  return user
}
export async function uploadMobileAvatar(file: File) {
  const generation = epoch, current = session
  if (!current) throw new MobileSessionChangedError()
  profileRevision++
  const body = new FormData(); body.append('avatar', file)
  const response = await mobileApi.post('/user/avatar', body, { timeout: 30_000 })
  return acceptProfileChange(response.data.data as User, generation, current.user.id)
}
export async function fetchMobileBirthInfo(): Promise<MobileBirthInfo> {
  const info = (await mobileApi.get('/user/birth-info')).data.data
  return { birthday: info.birthday ?? null, birthTime: info.birthTime ?? null, zodiacSign: info.zodiacSign ?? null }
}
export async function saveMobileBirthInfo(value: Pick<MobileBirthInfo, 'birthday' | 'birthTime'>) {
  const generation = epoch, current = session
  if (!current) throw new MobileSessionChangedError()
  profileRevision++
  const info = (await mobileApi.put('/user/birth-info', value)).data.data as MobileBirthInfo
  if (generation !== epoch || !session || session.user.id !== current.user.id) throw new MobileSessionChangedError()
  const user = { ...session.user, birthday: info.birthday ?? null, birthTime: info.birthTime ?? null, zodiacSign: info.zodiacSign ?? null }
  await acceptProfileChange(user, generation, current.user.id)
  return info
}
export async function fetchMobileSettings(): Promise<{ cardBack?: string | null }> { return (await mobileApi.get('/user/settings')).data.data }
export async function redeemMobileInvitation(code: string): Promise<MobileRedemption> {
  const generation = epoch, current = session
  if (!current) throw new MobileSessionChangedError()
  profileRevision++
  const response = await mobileApi.post('/invitations/redeem', { code: code.trim() })
  if (generation !== epoch || session?.user.id !== current.user.id) throw new MobileSessionChangedError()
  profileRevision++
  if (!validMobileRedemption(response.data.data)) throw new Error('Invalid redemption response')
  return { type: response.data.data.type, value: response.data.data.value }
}
export async function fetchMobileReference() { return (await anonymous.get('/reference/core', { timeout: 10_000 })).data.data }
export async function fetchMobileHistory(options: { page: number; search?: string; type?: string; dateFrom?: string; dateTo?: string }) {
  return (await mobileApi.get('/readings/history', { params: { ...options, limit: 12 } })).data.data as HistoryPage
}
export async function fetchMobileReading(id: number) { return (await mobileApi.get(`/readings/history/${id}`)).data.data as ReadingHistoryEntry }
export async function deleteMobileReading(id: number) { await mobileApi.delete(`/readings/history/${id}`) }
export async function saveMobileReadingOutcome(id: number, rating: 'full' | 'partial' | 'none') {
  confirmedMutation(await mobileApi.post(`/readings/history/${id}/outcome`, { rating }))
}
export async function postMobileTask(kind: 'reading' | 'followup', requestId: string, payload: MobileReadingPayload | MobileFollowupPayload) {
  return (await mobileApi.post(kind === 'reading' ? '/mobile/readings' : '/mobile/followups', { ...payload, requestId })).data.data as MobileTask
}
export async function fetchMobileTask(requestId: string) { return (await mobileApi.get(`/mobile/requests/${requestId}`)).data.data as MobileTask }
export function mobileError(error: unknown, fallback = '暂时无法连接，请检查网络后重试。') {
  if (axios.isAxiosError(error)) { const message = error.response?.data?.message; return typeof message === 'string' && message ? message : fallback }
  if (error instanceof Error && error.name === 'MobileSessionChangedError') return '账号已切换，请重新操作。'
  return fallback
}
export function mobileRedemptionError(error: unknown, english: boolean) {
  const messages: Record<string, [string, string]> = {
    INVITATION_FORMAT_INVALID: ['兑换码格式无效，请检查后重试。', 'Check the code format and try again.'],
    INVITATION_NOT_FOUND: ['兑换码不存在，请检查是否输入完整。', 'This code was not found. Check the full code.'],
    INVITATION_DISABLED: ['此兑换码已停用。', 'This code has been disabled.'],
    INVITATION_EXPIRED: ['此兑换码已过期。', 'This code has expired.'],
    INVITATION_ALREADY_REDEEMED: ['当前账号已使用过此兑换码，可刷新权益确认。', 'You have already used this code. Refresh your benefits to check.'],
    INVITATION_EXHAUSTED: ['此兑换码已被使用完。', 'This code has no uses remaining.'],
    INVITATION_INVALID: ['此兑换码暂不可用，请联系提供方。', 'This code is unavailable. Contact the person who provided it.'],
  }
  if (axios.isAxiosError(error)) {
    const message = messages[error.response?.data?.code]
    if (message) return message[english ? 1 : 0]
    if (error.response?.status === 429) return english ? 'Too many attempts. Please try again later.' : '兑换尝试过于频繁，请稍后再试。'
    if (error.response?.status === 500) return english ? 'Redemption is temporarily unavailable. Try again later.' : '兑换暂不可用，请稍后重试。'
  }
  return mobileError(error, english ? 'The redemption could not be confirmed. Refresh your benefits before trying again.' : '暂未能确认兑换结果，请先刷新权益，再决定是否重试。')
}
export function mobileHttpStatus(error: unknown) { return axios.isAxiosError(error) ? error.response?.status : undefined }
export function mobileRetryAfter(error: unknown) {
  if (!axios.isAxiosError(error)) return null
  const raw = error.response?.headers?.['retry-after']
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(120_000, seconds * 1000) : null
}
