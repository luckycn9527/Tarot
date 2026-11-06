import assert from 'node:assert/strict'
import test from 'node:test'
import { abandonUnconfirmedFollowup, canAbandonUnconfirmedFollowup, type MobileTaskRecoveryState } from '../src/mobile/mobileTaskRecoveryModel'
import type { MobileTask, PendingMobileTask } from '../src/mobile/types'

type Options = Parameters<typeof abandonUnconfirmedFollowup>[0]
const task: PendingMobileTask = { schema: 1, owner: 71, requestId: 'a319d6e2-c61b-46c7-9d75-59958950d448', kind: 'followup', createdAt: Date.now(),
  payload: { readingId: 501, question: '那我下一步怎么做？', locale: 'zh-CN' } }
const missing = Object.assign(new Error('Fixture task missing'), { status: 404 })
function harness(overrides: Partial<Options> = {}) {
  const state: MobileTaskRecoveryState = { owner: 71, readingId: 501, readingMissing: true, task: structuredClone(task), needsResend: true, posting: false, polling: false }
  const calls = { confirm: 0, inspect: 0, preserve: 0, remove: 0, completed: 0, accepted: 0 }
  const session = { current: true }, storage = new Map<string, unknown>([['pending-71', structuredClone(task)], ['draft-71', 'unrelated new question'], ['draft-72', 'other account question']])
  const options: Options = {
    state: () => state, sameSession: () => session.current && state.owner === task.owner,
    confirm: () => { calls.confirm++; return true },
    inspect: async () => { calls.inspect++; throw missing }, isMissing: error => (error as { status?: number })?.status === 404,
    accepted: async () => { calls.accepted++ },
    preserve: async saved => { calls.preserve++; storage.set('task-feedback-71', structuredClone(saved)) },
    remove: async saved => { calls.remove++; if (state.task?.requestId !== saved.requestId) return false; storage.delete('pending-71'); state.task = null; return true },
    completed: () => { calls.completed++ }, ...overrides,
  }
  return { state, calls, session, storage, options, run: () => abandonUnconfirmedFollowup(options) }
}

test('a confirmed missing-record follow-up is preserved before its local pending state is released', async () => {
  const h = harness()
  assert.equal(await h.run(), 'abandoned')
  assert.equal(h.state.task, null); assert.equal(h.storage.has('pending-71'), false)
  assert.deepEqual(h.storage.get('task-feedback-71'), task)
  assert.equal(h.storage.get('draft-71'), 'unrelated new question'); assert.equal(h.storage.get('draft-72'), 'other account question')
  assert.deepEqual(h.calls, { confirm: 1, inspect: 1, preserve: 1, remove: 1, completed: 1, accepted: 0 })
})

test('cancelling confirmation keeps the request and never checks or writes anything', async () => {
  const h = harness({ confirm: () => false })
  assert.equal(await h.run(), 'cancelled')
  assert.deepEqual(h.state.task, task); assert.equal(h.calls.inspect, 0); assert.equal(h.calls.preserve, 0); assert.equal(h.calls.remove, 0)
})

test('a follow-up not marked unconfirmed cannot be abandoned even when its record is missing', async () => {
  const h = harness(); h.state.needsResend = false
  assert.equal(canAbandonUnconfirmedFollowup(h.state), false); assert.equal(await h.run(), 'unavailable')
  assert.equal(h.calls.confirm, 0); assert.deepEqual(h.state.task, task)
})

test('a second lookup finding an accepted task delegates to normal processing and never removes it', async () => {
  for (const status of ['running', 'succeeded', 'failed'] as const) {
    const h = harness({ inspect: async () => ({ requestId: task.requestId, kind: 'followup', status }) })
    assert.equal(await h.run(), 'accepted'); assert.equal(h.calls.accepted, 1)
    assert.equal(h.calls.preserve, 0); assert.equal(h.calls.remove, 0); assert.deepEqual(h.state.task, task)
  }
})

test('other owners, other readings and original-reading tasks cannot use follow-up recovery', async () => {
  for (const change of [
    (s: MobileTaskRecoveryState) => { s.owner = 72 },
    (s: MobileTaskRecoveryState) => { s.readingId = 502 },
    (s: MobileTaskRecoveryState) => { s.readingMissing = false },
    (s: MobileTaskRecoveryState) => { s.task = { ...task, kind: 'reading' } },
  ]) {
    const h = harness(); change(h.state)
    assert.equal(await h.run(), 'unavailable'); assert.equal(h.calls.confirm, 0); assert.equal(h.calls.remove, 0)
  }
})

test('active posting or task polling prevents confirmation and local deletion', async () => {
  for (const field of ['posting', 'polling'] as const) {
    const h = harness(); h.state[field] = true
    assert.equal(await h.run(), 'unavailable'); assert.equal(h.calls.confirm, 0); assert.equal(h.calls.remove, 0)
  }
})

test('an account change while asynchronous confirmation is open cannot affect the new session', async () => {
  let resolve!: (value: boolean) => void
  const h = harness({ confirm: () => new Promise<boolean>(done => { resolve = done }) })
  const recovery = h.run(); h.state.owner = 72; resolve(true)
  assert.equal(await recovery, 'changed'); assert.equal(h.calls.inspect, 0); assert.equal(h.calls.remove, 0)
})

test('a late accepted response after owner or same-owner session change cannot mutate pending data', async () => {
  for (const changeOwner of [true, false]) {
    let resolve!: (value: MobileTask) => void
    const h = harness({ inspect: () => new Promise<MobileTask>(done => { resolve = done }) })
    const recovery = h.run(); await new Promise(done => setImmediate(done))
    if (changeOwner) h.state.owner = 72; else h.session.current = false
    resolve({ requestId: task.requestId, kind: 'followup', status: 'running' })
    assert.equal(await recovery, 'changed'); assert.equal(h.calls.accepted, 0); assert.equal(h.calls.remove, 0)
  }
})

test('a newer pending request while preservation is in flight is never removed', async () => {
  let release!: () => void
  const h = harness({ preserve: () => new Promise<void>(done => { release = done }) })
  const recovery = h.run(); await new Promise(done => setImmediate(done))
  const newer = { ...task, requestId: 'b319d6e2-c61b-46c7-9d75-59958950d448' }
  h.state.task = newer; h.storage.set('pending-71', newer); release()
  assert.equal(await recovery, 'changed'); assert.equal(h.calls.remove, 0); assert.deepEqual(h.storage.get('pending-71'), newer)
})

test('a preservation or pending-removal storage failure leaves the original text recoverable', async () => {
  for (const operation of ['preserve', 'remove'] as const) {
    const h = harness(); h.options[operation] = async () => { throw new Error('Fixture storage failure') }
    await assert.rejects(h.run())
    assert.deepEqual(h.state.task, task); assert.deepEqual(h.storage.get('pending-71'), task); assert.equal(h.calls.completed, 0)
    if (operation === 'preserve') assert.equal(h.calls.remove, 0)
    else assert.deepEqual(h.storage.get('task-feedback-71'), task)
  }
})

test('an unconfirmed removal does not report successful local release', async () => {
  const h = harness({ remove: async () => false })
  assert.equal(await h.run(), 'changed'); assert.equal(h.calls.completed, 0); assert.deepEqual(h.state.task, task)
})

test('network errors and invalid success responses are never treated as task-not-found', async () => {
  for (const inspect of [
    async () => { throw Object.assign(new Error('Fixture server failure'), { status: 503 }) },
    async () => undefined as unknown as MobileTask,
    async () => ({ requestId: 'different', kind: 'followup', status: 'running' }) as MobileTask,
  ]) {
    const h = harness({ inspect }); await assert.rejects(h.run())
    assert.equal(h.calls.preserve, 0); assert.equal(h.calls.remove, 0); assert.deepEqual(h.state.task, task)
  }
})

test('a session change immediately after local removal cannot write feedback into the next account UI', async () => {
  const h = harness(); h.options.remove = async () => { h.state.task = null; h.state.owner = 72; return true }
  assert.equal(await h.run(), 'changed'); assert.equal(h.calls.completed, 0)
})
