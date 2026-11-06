import { accountEmailIssue } from './mobileAccountAccessModel'
import { readMobileValue, verifyMobileValueRemoved, writeMobileValue } from './mobileStorage'
export { MOBILE_PASSWORD_RETURN_URL, isMobilePasswordReturnUrl, supportsAndroidPasswordReturn } from './mobilePasswordReturnModel'
export const PASSWORD_RETURN_TTL_MS = 60 * 60 * 1000
export interface MobilePasswordReturn {
  schema: 1
  owner: number | null
  email: string
  requestedAt: number
}

export function passwordReturnStorageKey(owner: number | null): string {
  if (owner !== null && (!Number.isSafeInteger(owner) || owner <= 0)) throw new Error('Invalid password return owner')
  return `password-return-${owner ?? 'guest'}`
}

export function validMobilePasswordReturn(value: unknown, owner: number | null, now = Date.now()): value is MobilePasswordReturn {
  if (!value || typeof value !== 'object' || !Number.isFinite(now)) return false
  if (owner !== null && (!Number.isSafeInteger(owner) || owner <= 0)) return false
  const pending = value as MobilePasswordReturn
  return pending.schema === 1 && pending.owner === owner && typeof pending.email === 'string' &&
    pending.email === pending.email.trim() && !accountEmailIssue(pending.email) &&
    Number.isFinite(pending.requestedAt) && pending.requestedAt >= 0 &&
    pending.requestedAt <= now && now - pending.requestedAt < PASSWORD_RETURN_TTL_MS
}

// Keep a read/consume together: an older completion must not delete a later
// request's email hint. This contains no authentication state or reset token.
let operations: Promise<unknown> = Promise.resolve()
function queued<T>(work: () => Promise<T>): Promise<T> {
  const operation = operations.then(work, work)
  operations = operation.then(() => undefined, () => undefined)
  return operation
}

async function removeConfirmed(key: string): Promise<void> {
  await writeMobileValue(key, null)
  await verifyMobileValueRemoved(key)
}

export function rememberMobilePasswordReturn(email: string, owner: number | null, now = Date.now()): Promise<void> {
  const key = passwordReturnStorageKey(owner), value = email.trim()
  if (accountEmailIssue(value) || !Number.isFinite(now) || now < 0) return Promise.reject(new Error('Invalid password return hint'))
  const pending: MobilePasswordReturn = { schema: 1, owner, email: value, requestedAt: now }
  return queued(async () => {
    await writeMobileValue(key, pending)
    const saved = await readMobileValue<unknown>(key)
    if (!validMobilePasswordReturn(saved, owner, now) || saved.email !== value || saved.requestedAt !== now) {
      throw new Error('Password return hint could not be confirmed')
    }
  })
}

export function readMobilePasswordReturn(owner: number | null, now = Date.now()): Promise<MobilePasswordReturn | null> {
  const key = passwordReturnStorageKey(owner)
  return queued(async () => {
    const value = await readMobileValue<unknown>(key)
    if (validMobilePasswordReturn(value, owner, now)) return value
    if (value !== null) await removeConfirmed(key)
    return null
  })
}

export function consumeMobilePasswordReturn(owner: number | null, now = Date.now()): Promise<MobilePasswordReturn | null> {
  const key = passwordReturnStorageKey(owner)
  return queued(async () => {
    const value = await readMobileValue<unknown>(key)
    await removeConfirmed(key)
    return validMobilePasswordReturn(value, owner, now) ? value : null
  })
}

export function clearMobilePasswordReturn(owner: number | null): Promise<void> {
  const key = passwordReturnStorageKey(owner)
  return queued(() => removeConfirmed(key))
}
