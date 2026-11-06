import assert from 'node:assert/strict'
import test from 'node:test'
import { createMobileFeedbackController, createMobileFeedbackDiagnostics, createMobileFeedbackState, mobileFeedbackContentLimit, mobileFeedbackStorageKey, normalizeMobileFeedbackDraft, type MobileFeedbackDraft, type MobileFeedbackPayload } from '../src/mobile/mobileFeedback'

const diagnostic = createMobileFeedbackDiagnostics({ version: '0.1.24', versionCode: 25, platform: 'android', userAgent: 'Android 15; sdk_ignored_user_agent', english: false })
const message = '翻牌后页面偶尔没有加载出来，希望可以检查一下。'
const settle = () => new Promise(resolve => setImmediate(resolve))
function fixture(owner: number | null = 71) {
  const state = createMobileFeedbackState(), records = new Map<string, unknown>(), sent: MobileFeedbackPayload[] = [], writes: MobileFeedbackDraft[] = []
  let active = true, online = true
  const io = { read: async () => structuredClone(records.get(mobileFeedbackStorageKey(owner)) ?? null),
    write: async (draft: MobileFeedbackDraft) => { writes.push(structuredClone(draft)); records.set(mobileFeedbackStorageKey(owner), structuredClone(draft)) },
    send: async (payload: MobileFeedbackPayload): Promise<unknown> => { sent.push(structuredClone(payload)); return { success: true, data: null } } }
  const controller = createMobileFeedbackController(state, { owner, isCurrentOwner: () => active, connected: () => online,
    read: () => io.read(), write: d => io.write(d), send: p => io.send(p), diagnostics: () => diagnostic, english: () => false, now: () => '2026-11-06T12:00:00.000Z' })
  return { state, records, sent, writes, io, controller, switchOwner: () => { active = false }, offline: () => { online = false } }
}

test('confirmed null-data receipt clears form and persists only an explicit receipt, with diagnostics opt-in off', async () => {
  const f = fixture(); await f.controller.load(); Object.assign(f.state, { content: `  ${message}  `, contact: '  optional contact  ', errorCode: 'NOT_SENT' })
  assert.equal(await f.controller.submit(), 'sent')
  assert.deepEqual(f.sent, [{ type: 'bug', content: message, contact: 'optional contact' }])
  assert.equal(f.state.outcome, 'sent'); assert.equal(f.state.content, ''); assert.equal(f.state.contact, ''); assert.equal(f.state.unconfirmed, false)
  assert.equal(f.state.lastSentAt, '2026-11-06T12:00:00.000Z'); assert.equal(f.state.localSaved, true)
  const saved = f.records.get(mobileFeedbackStorageKey(71)) as MobileFeedbackDraft
  assert.equal(saved.content, ''); assert.equal(saved.contact, ''); assert.equal(saved.lastSentAt, f.state.lastSentAt)
})

test('diagnostic payload is a whitelist, stays within server 2000 limit and cannot leak raw agent or user extras', async () => {
  const f = fixture(); await f.controller.load(); f.state.includeDiagnostics = true; f.state.errorCode = 'HASH_MISMATCH'
  const limit = mobileFeedbackContentLimit(f.state, diagnostic)
  f.state.content = 'a'.repeat(limit + 1); assert.equal(await f.controller.submit(), 'invalid'); assert.equal(f.sent.length, 0)
  f.state.content = 'a'.repeat(limit); assert.equal(await f.controller.submit(), 'sent'); assert.equal(f.sent[0]!.content.length, 2000)
  assert.match(f.sent[0]!.content, /Platform: android/); assert.match(f.sent[0]!.content, /OS: Android 15/); assert.match(f.sent[0]!.content, /Error: HASH_MISMATCH/)
  assert.equal(f.state.includeDiagnostics, false, 'a new feedback message needs a fresh diagnostics opt-in')
  assert.doesNotMatch(f.sent[0]!.content, /sdk_ignored_user_agent/)
  const malicious = createMobileFeedbackDiagnostics({ version: 'not-a-version-secret', versionCode: NaN, platform: 'private-device-secret', userAgent: 'Bearer secret', english: true })
  assert.deepEqual(malicious, { version: 'unknown', versionCode: 0, platform: 'web', osVersion: 'unknown', locale: 'en-US' })
})

test('invalid contact and diagnostic codes are rejected without sending; unchecked code is never attached', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message; f.state.contact = 'a'.repeat(101)
  assert.equal(await f.controller.submit(), 'invalid'); f.state.contact = ''; f.state.includeDiagnostics = true; f.state.errorCode = 'https://private.invalid/token'
  assert.equal(await f.controller.submit(), 'invalid'); assert.equal(f.sent.length, 0)
  f.state.includeDiagnostics = false; assert.equal(await f.controller.submit(), 'sent'); assert.equal(f.sent[0]!.content, message)
})

test('server failure preserves input and saves unconfirmed draft; retry is manual and never changes the draft owner', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message; f.state.contact = 'qq 12345'
  f.io.send = async p => { f.sent.push(p); throw Error('fixture unavailable') }
  assert.equal(await f.controller.submit(), 'failed'); assert.equal(f.state.content, message); assert.equal(f.state.contact, 'qq 12345'); assert.equal(f.state.unconfirmed, true); assert.equal(f.state.localSaved, true)
  assert.equal(f.sent.length, 1); await settle(); assert.equal(f.sent.length, 1)
  f.io.send = async p => { f.sent.push(p); return { success: true } }
  assert.equal(await f.controller.submit(), 'sent'); assert.equal(f.sent.length, 2); assert.equal(f.records.size, 1)
})

test('explicit offline submit saves a draft without a request and loading it never auto-sends', async () => {
  const f = fixture(null); await f.controller.load(); f.state.content = message; f.offline()
  assert.equal(await f.controller.submit(), 'offline'); assert.equal(f.sent.length, 0); assert.equal(f.state.unconfirmed, false)
  const other = fixture(null); other.records.set(mobileFeedbackStorageKey(null), f.records.get(mobileFeedbackStorageKey(null)))
  await other.controller.load(); assert.equal(other.state.content, message); assert.equal(other.sent.length, 0)
})

test('two concurrent submits issue only one request', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message
  let complete!: (value: unknown) => void
  f.io.send = async p => { f.sent.push(p); return new Promise(resolve => { complete = resolve }) }
  const first = f.controller.submit(); await settle(); assert.equal(await f.controller.submit(), 'busy'); assert.equal(f.sent.length, 1)
  complete({ success: true }); assert.equal(await first, 'sent')
})

test('closing an in-flight submission leaves an unconfirmed draft and a late receipt does not write after dispose', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message
  let complete!: (value: unknown) => void
  f.io.send = async p => { f.sent.push(p); return new Promise(resolve => { complete = resolve }) }
  const request = f.controller.submit(); await settle(); assert.equal(await f.controller.saveDraft(), true)
  const count = f.writes.length; f.controller.dispose(); complete({ success: true }); assert.equal(await request, 'stale')
  assert.equal(f.writes.length, count); assert.equal(f.state.content, message); assert.equal((f.records.get(mobileFeedbackStorageKey(71)) as MobileFeedbackDraft).unconfirmed, true)
})

test('an account change while sending cannot clear old text or write success into another account', async () => {
  const a = fixture(71), b = fixture(72); await a.controller.load(); await b.controller.load(); a.state.content = message; b.state.content = '另一个账号自己的未发送内容。'
  let complete!: (value: unknown) => void
  a.io.send = async () => new Promise(resolve => { complete = resolve })
  const request = a.controller.submit(); await settle(); const count = a.writes.length; a.switchOwner(); complete({ success: true }); assert.equal(await request, 'stale')
  assert.equal(a.writes.length, count); assert.equal(b.state.content, '另一个账号自己的未发送内容。'); assert.equal(b.state.outcome, 'idle'); assert.equal(b.records.size, 0)
})

test('a credential-generation rejection is stale even when the user id is unchanged', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message
  f.io.send = async () => { const error = new Error('Account changed'); error.name = 'MobileSessionChangedError'; throw error }
  assert.equal(await f.controller.submit(), 'stale'); assert.equal(f.writes.length, 1); assert.equal(f.state.outcome, 'idle')
})

test('local storage failures cannot turn confirmed server success into a retryable failure', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message; f.io.write = async () => { throw Error('storage unavailable') }
  assert.equal(await f.controller.submit(), 'sent'); assert.equal(f.state.outcome, 'sent'); assert.equal(f.state.localSaved, false); assert.equal(f.sent.length, 1); assert.equal(f.state.content, '')
})

test('readback detects silent storage failure, and malformed or wrong-account drafts are ignored', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message; f.io.write = async () => {}
  assert.equal(await f.controller.saveDraft(), false); assert.equal(f.state.localSaved, false)
  assert.equal(normalizeMobileFeedbackDraft({ schema: 1, owner: 72, content: message }, 71), null)
  assert.equal(normalizeMobileFeedbackDraft({ schema: 1, owner: 71, type: 'bug', content: 'a'.repeat(2001) }, 71), null)
  assert.throws(() => mobileFeedbackStorageKey(-1)); assert.equal(mobileFeedbackStorageKey(null), 'feedback-draft-guest')
})

test('a failed initial read blocks sending until an explicit successful reload', async () => {
  const f = fixture(); f.io.read = async () => { throw Error('locked') }; await f.controller.load(); assert.equal(f.state.loadError, true); f.state.content = message
  assert.equal(await f.controller.submit(), 'notReady'); assert.equal(f.sent.length, 0)
  f.io.read = async () => null; await f.controller.load(); assert.equal(f.state.loadError, false); assert.equal(await f.controller.submit(), 'sent')
})

test('a late old draft save cannot claim newly edited input was saved or write after an account clear', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message
  let complete!: () => void
  f.io.write = async draft => new Promise(resolve => { complete = () => { f.records.set(mobileFeedbackStorageKey(71), draft); resolve() } })
  const saving = f.controller.saveDraft(); f.state.content = '已经修改的新内容仍未保存。'; f.controller.edit(); complete(); assert.equal(await saving, false); assert.equal(f.state.localSaved, null)
  const second = f.controller.saveDraft(); f.switchOwner(); complete(); assert.equal(await second, false); assert.equal(f.state.localSaved, null)
})

test('truthy or missing success fields never claim delivery', async () => {
  for (const result of [{}, { success: false }, { success: 'true' }]) {
    const f = fixture(); await f.controller.load(); f.state.content = message; f.io.send = async () => result
    assert.equal(await f.controller.submit(), 'failed'); assert.equal(f.state.content, message); assert.equal(f.state.lastSentAt, null)
  }
})

test('a late draft read cannot refill a form after its account scope was closed', async () => {
  const f = fixture(); let complete!: (value: unknown) => void
  f.io.read = async () => new Promise(resolve => { complete = resolve })
  const loading = f.controller.load(); f.switchOwner(); complete({ schema: 1, owner: 71, type: 'bug', content: message, contact: '', includeDiagnostics: false, errorCode: '', unconfirmed: true, lastSentAt: null })
  await loading; assert.equal(f.state.content, ''); assert.equal(f.state.unconfirmed, false); assert.equal(f.writes.length, 0)
})

test('losing connectivity while saving the pre-submit draft never starts the API call', async () => {
  const f = fixture(); await f.controller.load(); f.state.content = message
  f.io.write = async draft => { f.records.set(mobileFeedbackStorageKey(71), structuredClone(draft)); f.offline() }
  assert.equal(await f.controller.submit(), 'offline'); assert.equal(f.sent.length, 0); assert.equal(f.state.unconfirmed, false); assert.equal(f.state.content, message)
})
