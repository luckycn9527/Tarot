import test from 'node:test'
import assert from 'node:assert/strict'
import {
  accountAccessIssue, accountEmailIssue, beginAccountAccessRequest, createAccountAccessState,
  finishAccountAccessRequest, registrationAccountPayload, registrationCodeSeconds,
  type AccountAccessFields,
} from '../src/mobile/mobileAccountAccessModel'

function fields(values: Partial<AccountAccessFields> = {}): AccountAccessFields {
  return { email: ' person@example.com ', emailCode: '012345', nickname: '小星', password: 'secret123', repeatPassword: 'secret123', oldPassword: 'old-secret', deleteConfirmed: false, ...values }
}

test('registration respects server field limits and requires a six digit code', () => {
  assert.equal(accountAccessIssue('register', fields()), null)
  assert.equal(accountAccessIssue('register', fields({ nickname: 'a'.repeat(20), password: 'b'.repeat(50), repeatPassword: 'b'.repeat(50) })), null)
  for (const emailCode of ['12345', '1234567', '12x456', '１２３４５６']) assert.equal(accountAccessIssue('register', fields({ emailCode }))?.field, 'emailCode')
  for (const nickname of ['a', ' '.repeat(4), 'a'.repeat(21)]) assert.equal(accountAccessIssue('register', fields({ nickname }))?.field, 'nickname')
  for (const password of ['12345', 'a'.repeat(51)]) assert.equal(accountAccessIssue('register', fields({ password, repeatPassword: password }))?.field, 'password')
  assert.equal(accountAccessIssue('register', fields({ repeatPassword: 'different' }))?.field, 'repeatPassword')
})

test('registration normalizes identifiers but preserves exact passwords', () => {
  const value = fields({ emailCode: ' 012345 ', nickname: ' 小星 ', password: ' secret ' })
  assert.deepEqual(registrationAccountPayload(value), { email: 'person@example.com', emailCode: '012345', nickname: '小星', password: ' secret ' })
})

test('forgot password only asks for a valid email and returns localized validation', () => {
  assert.equal(accountAccessIssue('forgot', fields({ nickname: '', password: '', repeatPassword: '', emailCode: '' })), null)
  for (const email of ['', 'bad', 'a@b', 'a b@example.com', 'a@b@example.com']) assert.equal(accountEmailIssue(email)?.field, 'email')
  assert.match(accountEmailIssue('bad', true)?.message || '', /email/)
})

test('password changes require the current password, a new value and exact confirmation', () => {
  assert.equal(accountAccessIssue('password', fields()), null)
  assert.equal(accountAccessIssue('password', fields({ oldPassword: '' }))?.field, 'oldPassword')
  assert.equal(accountAccessIssue('password', fields({ oldPassword: 'a'.repeat(101) }))?.field, 'oldPassword')
  assert.equal(accountAccessIssue('password', fields({ oldPassword: 'secret123' }))?.field, 'password')
  assert.equal(accountAccessIssue('password', fields({ repeatPassword: ' secret123' }))?.field, 'repeatPassword')
})

test('deletion requires acknowledgement and current password without applying new password rules', () => {
  assert.equal(accountAccessIssue('delete', fields())?.field, 'deleteConfirmed')
  assert.equal(accountAccessIssue('delete', fields({ deleteConfirmed: true, password: '' }))?.field, 'password')
  assert.equal(accountAccessIssue('delete', fields({ deleteConfirmed: true, password: 'a'.repeat(101) }))?.field, 'password')
  assert.equal(accountAccessIssue('delete', fields({ deleteConfirmed: true, password: 'old' })), null)
})

test('one request lock prevents overlapping code and submit, and failures permit deliberate retry', () => {
  const state = createAccountAccessState()
  assert.equal(beginAccountAccessRequest(state, 'submit', false), false)
  assert.equal(state.pending, null)
  assert.equal(beginAccountAccessRequest(state, 'code', true), true)
  assert.equal(beginAccountAccessRequest(state, 'submit', true), false)
  assert.equal(beginAccountAccessRequest(state, 'code', true), false)
  assert.equal(finishAccountAccessRequest(state), false)
  assert.equal(beginAccountAccessRequest(state, 'submit', true), true)
})

test('cooldown uses elapsed time, blocks only code requests and ends at exactly sixty seconds', () => {
  const state = createAccountAccessState()
  state.codeAvailableAt = 61_000
  assert.equal(registrationCodeSeconds(state.codeAvailableAt, 1_000), 60)
  assert.equal(registrationCodeSeconds(state.codeAvailableAt, 60_001), 1)
  assert.equal(beginAccountAccessRequest(state, 'code', true, 60_999), false)
  assert.equal(beginAccountAccessRequest(state, 'submit', true, 2_000), true)
  finishAccountAccessRequest(state)
  assert.equal(beginAccountAccessRequest(state, 'code', true, 61_000), true)
  assert.equal(registrationCodeSeconds(state.codeAvailableAt, 90_000), 0)
})

test('terminal success prevents repeat requests and delivers session completion only once', () => {
  for (const result of ['registered', 'reset-sent', 'session-ended'] as const) {
    const state = createAccountAccessState()
    assert.equal(beginAccountAccessRequest(state, 'submit', true), true)
    assert.equal(finishAccountAccessRequest(state, result), true)
    assert.equal(finishAccountAccessRequest(state, result), false)
    assert.equal(finishAccountAccessRequest(state), false)
    assert.equal(state.result, result)
    assert.equal(beginAccountAccessRequest(state, 'submit', true), false)
    assert.equal(beginAccountAccessRequest(state, 'code', true), false)
  }
})
