import test from 'node:test'
import assert from 'node:assert/strict'
import { createFeedbackState, createFeedbackSubmitter, FEEDBACK_LIMITS, normalizeFeedbackHistory, type FeedbackRecord } from '../src/utils/feedbackSubmission'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fixture(send: (payload: { type: string; content: string; contact?: string }) => Promise<unknown>, storageMode: 'works' | 'throws' | 'silentFailure' = 'works') {
  const state = createFeedbackState()
  state.content = 'A useful feedback message'
  state.email = 'reader@example.com'
  let stored: FeedbackRecord[] = []
  let nextId = 0
  const submitter = createFeedbackSubmitter(state, {
    send,
    createId: () => `draft-${++nextId}`,
    now: () => '2026-11-05T00:00:00.000Z',
    writeHistory: records => {
      if (storageMode === 'throws') throw new Error('quota exceeded')
      if (storageMode === 'works') stored = structuredClone(records)
    },
    readHistory: () => stored,
  })
  return { state, ...submitter, stored: () => stored }
}

test('rejected request stays failed, preserves input, and saves an explicitly unconfirmed draft', async () => {
  const pending = deferred<unknown>()
  const f = fixture(() => pending.promise)
  const request = f.submit()
  assert.equal(f.state.isSubmitting, true)
  assert.equal(f.state.outcome, 'idle')
  assert.equal(f.state.history.length, 0)
  pending.reject(new Error('offline'))
  assert.equal(await request, 'failed')
  assert.equal(f.state.isSubmitting, false)
  assert.equal(f.state.outcome, 'failed')
  assert.equal(f.state.content, 'A useful feedback message')
  assert.equal(f.state.email, 'reader@example.com')
  assert.equal(f.state.localSaved, true)
  assert.equal(f.stored()[0]?.delivery, 'unsent')
})

test('two concurrent submits make one request; production success with null data is enough', async () => {
  const pending = deferred<unknown>()
  let calls = 0
  const f = fixture(async payload => {
    calls++
    assert.deepEqual(payload, { type: 'feature', content: 'A useful feedback message', contact: 'reader@example.com' })
    return pending.promise
  })
  const first = f.submit()
  assert.equal(await f.submit(), 'busy')
  assert.equal(calls, 1)
  pending.resolve({ success: true, data: null })
  assert.equal(await first, 'sent')
  assert.equal(f.state.outcome, 'sent')
  assert.equal(f.state.isSubmitting, false)
  assert.equal(f.state.content, '')
  assert.equal(f.state.email, '')
  assert.equal(f.stored()[0]?.delivery, 'sent')
  assert.equal(f.stored()[0]?.serverId, undefined)
})

test('manual retry replaces one failed draft, including edits, and retains an optional server ID', async () => {
  let calls = 0
  const f = fixture(async () => {
    calls++
    if (calls === 1) throw new Error('offline')
    return { success: true, data: { id: 27 } }
  })
  await f.submit()
  const draftId = f.state.history[0]?.id
  f.state.content = 'Corrected feedback for retry'
  assert.equal(calls, 1)
  assert.equal(await f.submit(), 'sent')
  assert.equal(calls, 2)
  assert.equal(f.state.history.length, 1)
  assert.equal(f.stored().length, 1)
  assert.equal(f.state.history[0]?.id, draftId)
  assert.equal(f.state.history[0]?.content, 'Corrected feedback for retry')
  assert.equal(f.state.history[0]?.delivery, 'sent')
  assert.equal(f.state.history[0]?.serverId, 27)
})

test('loading a saved draft never sends it, and retry after reload still replaces its record', async () => {
  let calls = 0
  const draft = { id: 'draft-old', type: 'bug', email: 'reader@example.com', content: 'Feedback saved before reload', time: '2026-11-05', delivery: 'unsent' as const }
  const f = fixture(async () => { calls++; return { success: true, data: null } })
  f.state.history = [draft]
  f.restoreDraft(draft)
  assert.equal(calls, 0)
  assert.equal(f.state.content, draft.content)
  assert.equal(f.state.draftId, 'draft-old')
  await f.submit()
  assert.equal(calls, 1)
  assert.equal(f.state.history.length, 1)
  assert.equal(f.state.history[0]?.id, 'draft-old')
})

for (const storageMode of ['throws', 'silentFailure'] as const) {
  test(`confirmed server success stays successful when local storage ${storageMode}`, async () => {
    const f = fixture(async () => ({ success: true, data: null }), storageMode)
    assert.equal(await f.submit(), 'sent')
    assert.equal(f.state.outcome, 'sent')
    assert.equal(f.state.localSaved, false)
    assert.equal(f.state.content, '')
    assert.equal(f.state.draftId, null)
    assert.equal(f.state.history[0]?.delivery, 'sent')
    assert.equal(await f.submit(), 'invalid')
  })

  test(`failed server request does not claim a saved draft when local storage ${storageMode}`, async () => {
    const f = fixture(async () => { throw new Error('offline') }, storageMode)
    assert.equal(await f.submit(), 'failed')
    assert.equal(f.state.localSaved, false)
    assert.equal(f.state.content, 'A useful feedback message')
    assert.equal(f.state.email, 'reader@example.com')
    assert.equal(f.state.history[0]?.delivery, 'unsent')
  })
}

test('a 2xx response with missing/false success cannot display sent', async () => {
  for (const response of [{ success: false }, { data: null }, null, '<html>error</html>']) {
    const f = fixture(async () => response)
    assert.equal(await f.submit(), 'failed')
    assert.equal(f.state.outcome, 'failed')
    assert.equal(f.state.history[0]?.delivery, 'unsent')
    assert.equal(f.state.content, 'A useful feedback message')
  }
})

test('legacy history stays delivery-unknown and malformed entries cannot break rendering', () => {
  const records = normalizeFeedbackHistory([null, 7, { content: 'Old feedback', type: 'bug', time: 'yesterday' }, { content: 'Another old feedback', delivery: 'made-up' }])
  assert.equal(records.length, 2)
  assert.equal(records[0]?.delivery, 'legacyunknown')
  assert.equal(records[1]?.delivery, 'legacyunknown')
  assert.notEqual(records[0]?.id, records[1]?.id)
})

test('content/contact bounds stop invalid requests and accept the server-compatible maximum', async () => {
  let calls = 0
  const f = fixture(async () => { calls++; return { success: true, data: null } })
  for (const content of ['   ', 'too short', 'x'.repeat(FEEDBACK_LIMITS.maxContent + 1)]) {
    f.state.content = content
    assert.equal(await f.submit(), 'invalid')
  }
  f.state.content = 'x'.repeat(FEEDBACK_LIMITS.maxContent)
  f.state.email = 'a'.repeat(FEEDBACK_LIMITS.maxContact + 1)
  assert.equal(await f.submit(), 'invalid')
  assert.equal(calls, 0)
  f.state.email = 'a'.repeat(FEEDBACK_LIMITS.maxContact)
  assert.equal(await f.submit(), 'sent')
  assert.equal(calls, 1)
})

for (const oldResult of ['success', 'failure'] as const) {
  test(`a previous account's late ${oldResult} cannot persist its text or unlock the new account's request`, async () => {
    const previous = deferred<unknown>()
    const current = deferred<unknown>()
    let calls = 0
    const f = fixture(() => ++calls === 1 ? previous.promise : current.promise)
    const oldRequest = f.submit()
    f.resetSession([])
    f.state.content = 'Feedback for the new account'
    f.state.email = 'new-owner@example.com'
    const newRequest = f.submit()
    if (oldResult === 'success') previous.resolve({ success: true, data: null })
    else previous.reject(new Error('Session changed'))
    assert.equal(await oldRequest, 'stale')
    assert.equal(f.state.isSubmitting, true)
    assert.equal(f.state.content, 'Feedback for the new account')
    assert.equal(f.state.email, 'new-owner@example.com')
    assert.equal(f.state.history.length, 0)
    assert.equal(f.stored().length, 0)
    current.resolve({ success: true, data: null })
    assert.equal(await newRequest, 'sent')
    assert.equal(f.stored().length, 1)
    assert.equal(f.stored()[0]?.content, 'Feedback for the new account')
  })
}
