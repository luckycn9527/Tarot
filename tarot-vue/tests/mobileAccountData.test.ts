import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/mobile/mobileAccountData.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'isolated-account-data', setup(builder) {
    builder.onResolve({ filter: /^\.\/mobileStorage$/ }, () => ({ path: 'storage', namespace: 'account-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'account-test' }, () => ({ contents: 'export const readMobileValue=key=>__store.read(key);export const writeMobileValue=(key,value)=>__store.write(key,value);export const verifyMobileValueRemoved=key=>__store.verify(key);' }))
  } }],
})
function boot(options: { failed?: Set<string>; silent?: Set<string>; unreadable?: Set<string>; hold?: string } = {}) {
  const data = new Map<string, unknown>(), writes: string[] = []
  let release: (() => void) | undefined
  const store = {
    read: async (key: string) => structuredClone(data.get(key) ?? null),
    verify: async (key: string) => {
      if (options.unreadable?.has(key)) throw new Error('Fixture confirmation unavailable')
      if (data.has(key)) throw new Error('Fixture data remains')
    },
    write: async (key: string, value: unknown) => {
      writes.push(key)
      if (options.hold === key) await new Promise<void>(resolve => { release = resolve })
      if (options.failed?.has(key)) throw new Error('Fixture storage unavailable')
      if (options.silent?.has(key)) return
      if (value === null) data.delete(key)
      else data.set(key, structuredClone(value))
    },
  }
  const module = { exports: {} }
  new Function('module', 'exports', '__store', compiled.outputFiles[0]!.text)(module, module.exports, store)
  return { api: module.exports as typeof import('../src/mobile/mobileAccountData'), data, writes, release: () => release?.() }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test('account keys explicitly cover daily, drafts, reader preferences, feedback and password hints', () => {
  const { api } = boot()
  const keys = api.accountDataKeys(71)
  assert.equal(new Set(keys).size, 15)
  for (const key of ['daily-71', 'daily-yesterday-71', 'draft-71', 'next-draft-71', 'ask-drafts-71', 'pending-71',
    'last-71', 'history-71', 'completion-71', 'history-view-71', 'followup-drafts-71', 'task-feedback-71',
    'reader-preference-71', 'feedback-draft-71', 'password-return-71']) assert.ok(keys.includes(key), key)
})

test('clearing one signed-out account preserves every other account, guest draft and global preference', async () => {
  const { api, data } = boot()
  for (const key of [...api.accountDataKeys(71), ...api.accountDataKeys(72), 'draft-guest', 'feedback-draft-guest',
    'password-return-guest', 'session', 'locale', 'updater-state']) data.set(key, { fixture: key })
  const retained = new Map([...data].filter(([key]) => !api.accountDataKeys(71).includes(key)))
  await api.clearAccountData(71)
  assert.deepEqual(data, retained)
})

test('a partial failure is reported only after trying all other private keys', async () => {
  const { api, data, writes } = boot({ failed: new Set(['daily-71', 'history-71']) })
  for (const key of api.accountDataKeys(71)) data.set(key, 'fixture')
  await assert.rejects(api.clearAccountData(71), error => {
    assert.ok(error instanceof api.MobileAccountDataClearError)
    assert.equal(error.owner, 71)
    assert.deepEqual(new Set(error.failedKeys), new Set(['daily-71', 'history-71']))
    return true
  })
  assert.equal(writes.length, 15)
  assert.deepEqual(new Set(data.keys()), new Set(['daily-71', 'history-71']))
})

test('a password-hint removal failure cannot be hidden as a successful account cleanup', async () => {
  const { api, data } = boot({ failed: new Set(['password-return-71']) })
  for (const key of api.accountDataKeys(71)) data.set(key, 'fixture')
  await assert.rejects(api.clearAccountData(71), error => error instanceof api.MobileAccountDataClearError && error.failedKeys[0] === 'password-return-71')
  assert.deepEqual([...data.keys()], ['password-return-71'])
})

test('invalid account identities never reach local storage', async () => {
  const { api, data, writes } = boot()
  data.set('session', 'preserved')
  for (const owner of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => api.accountDataKeys(owner))
    await assert.rejects(api.clearAccountData(owner))
  }
  assert.equal(writes.length, 0)
  assert.equal(data.get('session'), 'preserved')
})

test('a delayed cleanup stays attached to its old account after a new account signs in', async () => {
  const { api, data, release } = boot({ hold: 'history-71' })
  for (const key of api.accountDataKeys(71)) data.set(key, 'old fixture')
  const clearing = api.clearAccountData(71)
  await settle()
  data.set('session', { userId: 72 }); data.set('draft-72', 'newly typed question'); data.set('daily-72', 'newly revealed card')
  release(); await clearing
  assert.deepEqual(data.get('session'), { userId: 72 })
  assert.equal(data.get('draft-72'), 'newly typed question')
  assert.equal(data.get('daily-72'), 'newly revealed card')
})

test('repeating a successful cleanup is safe and leaves no target account keys', async () => {
  const { api, data } = boot()
  data.set('daily-71', 'fixture')
  await api.clearAccountData(71); await api.clearAccountData(71)
  assert.equal(data.size, 0)
})

test('a silently ignored removal is reported even though the write promise resolves', async () => {
  const { api, data } = boot({ silent: new Set(['daily-71']) })
  for (const key of api.accountDataKeys(71)) data.set(key, 'fixture')
  await assert.rejects(api.clearAccountData(71), error => error instanceof api.MobileAccountDataClearError && error.failedKeys.includes('daily-71'))
  assert.deepEqual([...data.keys()], ['daily-71'])
})

test('a removal that cannot be read back is never reported as confirmed cleanup', async () => {
  const { api, data, writes } = boot({ unreadable: new Set(['history-71']) })
  for (const key of api.accountDataKeys(71)) data.set(key, 'fixture')
  await assert.rejects(api.clearAccountData(71), error => error instanceof api.MobileAccountDataClearError && error.failedKeys.includes('history-71'))
  assert.equal(data.size, 0)
  assert.equal(writes.length, 15)
})
