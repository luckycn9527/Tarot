import type { User } from '@/stores/auth'

export interface MobileRedemption { type: 'vip_days' | 'quota'; value: number }
export function validMobileRedemption(value: unknown): value is MobileRedemption {
  const result = value as MobileRedemption | null
  return !!result && (result.type === 'vip_days' || result.type === 'quota') && Number.isInteger(result.value) && result.value >= 1 && result.value <= 3650
}
export function redemptionCodeError(code: string, english = false) {
  if (!code.trim()) return english ? 'Enter your redemption code.' : '请输入兑换码。'
  return /^[A-Za-z0-9_-]{4,50}$/.test(code.trim()) ? '' : english ? 'Use 4–50 letters, numbers, hyphens or underscores.' : '兑换码应为 4–50 位字母、数字、短横线或下划线。'
}
// The quota endpoint retains the original expiry, including an expired membership.
// Keep that date available for the account page while access checks still use time.
export function mergeMobileQuota(user: User, value: unknown): User {
  const quota = value as Record<string, unknown> | null
  if (!quota || typeof quota !== 'object') return user
  const next = { ...user }
  if (Number.isSafeInteger(quota.remaining) && Number(quota.remaining) >= 0) next.remainingFreeQuota = Number(quota.remaining)
  if ((quota.membership === 'vip' || quota.membership === 'free') &&
      (quota.membershipExpiresAt === null || (typeof quota.membershipExpiresAt === 'string' && Number.isFinite(Date.parse(quota.membershipExpiresAt))))) {
    next.membership = quota.membership
    next.membershipExpiresAt = quota.membershipExpiresAt
  }
  return next
}
