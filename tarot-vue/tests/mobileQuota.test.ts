import test from 'node:test'
import assert from 'node:assert/strict'
import { followupQuotaNote, mobileQuotaResetLabel } from '../src/mobile/mobileQuota'
import { mergeMobileQuota } from '../src/mobile/mobileMembershipModel'
import type { User } from '../src/stores/auth'

test('VIP follow-ups never claim they consume a daily free credit even with zero balance', () => {
  assert.match(followupQuotaNote(true, 0, undefined, false), /不消耗/)
  assert.match(followupQuotaNote(true, 0, undefined, true), /Does not use/)
  assert.match(followupQuotaNote(false, 3, undefined, false), /当前可用 3 次/)
  assert.match(followupQuotaNote(false, 0, undefined, true), /No free credits/)
})
test('only valid future reset instants are rendered and quota merges preserve verified reset metadata', () => {
  assert.equal(mobileQuotaResetLabel('invalid', false), '')
  assert.equal(mobileQuotaResetLabel('2000-01-01', false), '')
  const original = { id: 1, remainingFreeQuota: 2, membership: 'free', membershipExpiresAt: null } as User
  const value = mergeMobileQuota(original, { remaining: 0, resetsAt: '2099-01-01T00:00:00Z', timeZone: 'Asia/Shanghai' })
  assert.equal(value.quotaResetsAt, '2099-01-01T00:00:00Z')
  assert.equal(value.quotaTimeZone, 'Asia/Shanghai')
  assert.equal(value.remainingFreeQuota, 0)
  assert.equal(original.remainingFreeQuota, 2)
  assert.ok(mobileQuotaResetLabel(value.quotaResetsAt, true))
  assert.equal(mergeMobileQuota(value, { resetsAt: 'bad', timeZone: 'invalid/zone' }).quotaTimeZone, 'Asia/Shanghai')
})
