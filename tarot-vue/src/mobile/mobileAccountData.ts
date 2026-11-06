import { verifyMobileValueRemoved, writeMobileValue } from './mobileStorage'
import { clearMobilePasswordReturn, passwordReturnStorageKey } from './mobilePasswordReturn'

// Explicit ownership keeps global preferences, guest drafts and other accounts intact.
const privatePrefixes = ['draft', 'next-draft', 'ask-drafts', 'pending', 'last', 'history', 'completion', 'history-view',
  'followup-drafts', 'task-feedback', 'reader-preference', 'daily', 'daily-yesterday', 'feedback-draft'] as const

function checkedOwner(owner: number) {
  if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error('Invalid account data owner')
  return owner
}
export function accountDataKeys(owner: number): string[] {
  checkedOwner(owner)
  return [...privatePrefixes.map(name => `${name}-${owner}`), passwordReturnStorageKey(owner)]
}
export class MobileAccountDataClearError extends Error {
  constructor(public readonly owner: number, public readonly failedKeys: readonly string[]) {
    super('Some local account data could not be removed')
    this.name = 'MobileAccountDataClearError'
  }
}
export async function clearAccountData(owner: number): Promise<void> {
  const keys = accountDataKeys(owner)
  const results = await Promise.allSettled([
    ...privatePrefixes.map(async name => {
      const key = `${name}-${owner}`
      await writeMobileValue(key, null)
      await verifyMobileValueRemoved(key)
    }),
    // Respect the password-return module's queue so an old consumption cannot race this removal.
    clearMobilePasswordReturn(owner),
  ])
  const failed = keys.filter((_, index) => results[index]?.status === 'rejected')
  if (failed.length) throw new MobileAccountDataClearError(owner, failed)
}
