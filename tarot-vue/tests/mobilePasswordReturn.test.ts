import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { MOBILE_PASSWORD_RETURN_URL, isMobilePasswordReturnUrl, supportsAndroidPasswordReturn } from '../src/mobile/mobilePasswordReturnModel'

test('only the exact parameter-free app return signal is accepted', () => {
  assert.equal(isMobilePasswordReturnUrl(MOBILE_PASSWORD_RETURN_URL), true)
  for (const value of [undefined, null, 1, '', 'ETOMD://auth/password-reset-complete', 'etomd://AUTH/password-reset-complete',
    'etomd://auth/password-reset-complete/', 'etomd://auth/password-reset-complete?token=inert-reset',
    'etomd://auth/password-reset-complete?email=someone@example.invalid', 'etomd://auth/password-reset-complete#done',
    'etomd://auth:80/password-reset-complete', 'etomd://attacker@auth/password-reset-complete',
    'etomd://auth/password-reset-%63omplete', 'etomd://auth/other', 'https://example.invalid/reset-password',
    'javascript:alert(1)', ' etomd://auth/password-reset-complete', 'etomd://auth/password-reset-complete\n']) {
    assert.equal(isMobilePasswordReturnUrl(value), false, String(value))
  }
})

test('website offers Android return only for Android user agents', () => {
  assert.equal(supportsAndroidPasswordReturn('Mozilla/5.0 (Linux; Android 15; test device)'), true)
  assert.equal(supportsAndroidPasswordReturn('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), false)
  assert.equal(supportsAndroidPasswordReturn('Mozilla/5.0 (Windows NT 10.0)'), false)
})

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/mobile/mobilePasswordReturn.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'isolated-password-return-storage', setup(builder) {
    builder.onResolve({ filter: /^\.\/mobileStorage$/ }, () => ({ path: 'storage', namespace: 'return-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'return-test' }, () => ({ contents: 'export const readMobileValue=key=>__store.read(key); export const writeMobileValue=(key,value)=>__store.write(key,value); export const verifyMobileValueRemoved=key=>__store.verifyRemoved(key);' }))
  } }],
})
const require = createRequire(import.meta.url)
const requestedAt = Date.parse('2026-11-06T00:00:00Z')
function boot() {
  const stored = new Map<string, unknown>(), reads: string[] = []
  let failWrite = false, silentWrite = false, silentDelete = false, failRead = false, failVerify = false
  let holdRead: ((key: string) => Promise<unknown>) | null = null
  const boundary = {
    async read(key: string) { if (failRead) throw Error('Storage read unavailable'); reads.push(key); return holdRead ? holdRead(key) : structuredClone(stored.get(key) ?? null) },
    async write(key: string, value: unknown) {
      if (failWrite) throw Error('Storage unavailable')
      if ((value === null && silentDelete) || (value !== null && silentWrite)) return
      stored.set(key, structuredClone(value))
    },
    async verifyRemoved(key: string) {
      if (failVerify) throw Error('Storage presence unavailable')
      if (stored.get(key) !== null && stored.get(key) !== undefined) throw Error('Stored value was not removed')
    },
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', '__store', compiled.outputFiles[0]!.text)(require, module, module.exports, boundary)
  return { api: module.exports as typeof import('../src/mobile/mobilePasswordReturn'), stored, reads,
    failWrites(value: boolean) { failWrite = value }, silentWrites(value: boolean) { silentWrite = value }, silentDeletes(value: boolean) { silentDelete = value },
    failReads(value: boolean) { failRead = value }, failVerification(value: boolean) { failVerify = value },
    holdReads(value: typeof holdRead) { holdRead = value } }
}

test('remembered email is trimmed, account scoped, and contains no reset credential', async () => {
  const { api, stored } = boot()
  await api.rememberMobilePasswordReturn(' guest@example.invalid ', null, requestedAt)
  await api.rememberMobilePasswordReturn('member@example.invalid', 71, requestedAt)
  const guest = await api.readMobilePasswordReturn(null, requestedAt + 1)
  assert.deepEqual(guest, { schema: 1, owner: null, email: 'guest@example.invalid', requestedAt })
  assert.equal((await api.readMobilePasswordReturn(71, requestedAt + 1))?.email, 'member@example.invalid')
  assert.equal(await api.readMobilePasswordReturn(72, requestedAt + 1), null)
  assert.equal(JSON.stringify([...stored.values()]).includes('password'), false)
  assert.equal(JSON.stringify([...stored.values()]).includes('token'), false)
})

test('one-hour hints expire and malformed or foreign-owner records are not returned', async () => {
  const { api, stored } = boot(), key = api.passwordReturnStorageKey(null)
  const hint = { schema: 1, owner: null, email: 'guest@example.invalid', requestedAt }
  assert.equal(api.validMobilePasswordReturn(hint, null, requestedAt + api.PASSWORD_RETURN_TTL_MS - 1), true)
  assert.equal(api.validMobilePasswordReturn(hint, null, requestedAt + api.PASSWORD_RETURN_TTL_MS), false)
  for (const value of [{ ...hint, owner: 71 }, { ...hint, requestedAt: requestedAt + 1 }, { ...hint, email: 'bad' }, { ...hint, email: ' guest@example.invalid' }, { ...hint, schema: 2 }]) {
    stored.set(key, value)
    assert.equal(await api.readMobilePasswordReturn(null, requestedAt), null)
    assert.equal(stored.get(key), null)
  }
  assert.equal(api.validMobilePasswordReturn({ ...hint, owner: -1 }, -1, requestedAt), false)
})

test('consumption is single-use and clearing an account leaves guest and other accounts intact', async () => {
  const { api } = boot()
  for (const owner of [null, 71, 72]) await api.rememberMobilePasswordReturn(`${owner ?? 'guest'}@example.invalid`, owner, requestedAt)
  assert.equal((await api.consumeMobilePasswordReturn(null, requestedAt + 1))?.email, 'guest@example.invalid')
  assert.equal(await api.consumeMobilePasswordReturn(null, requestedAt + 1), null)
  await api.clearMobilePasswordReturn(71)
  assert.equal(await api.readMobilePasswordReturn(71, requestedAt + 1), null)
  assert.equal((await api.readMobilePasswordReturn(72, requestedAt + 1))?.email, '72@example.invalid')
})

test('an in-flight old consume cannot delete a later remembered email', async () => {
  const { api, stored, holdReads } = boot(), key = api.passwordReturnStorageKey(null)
  await api.rememberMobilePasswordReturn('first@example.invalid', null, requestedAt)
  let release!: () => void
  let firstRead = true
  holdReads(async () => {
    if (!firstRead) return structuredClone(stored.get(key) ?? null)
    firstRead = false
    return new Promise(resolve => { const value = structuredClone(stored.get(key)); release = () => resolve(value) })
  })
  const consumed = api.consumeMobilePasswordReturn(null, requestedAt + 1)
  await new Promise(resolve => setImmediate(resolve))
  const remembered = api.rememberMobilePasswordReturn('second@example.invalid', null, requestedAt + 2)
  release(); await consumed; await remembered; holdReads(null)
  assert.equal((await api.readMobilePasswordReturn(null, requestedAt + 3))?.email, 'second@example.invalid')
})

test('storage failures reject without poisoning later cleanup or writes', async () => {
  const { api, failWrites } = boot()
  failWrites(true)
  await assert.rejects(api.rememberMobilePasswordReturn('guest@example.invalid', null, requestedAt))
  failWrites(false)
  await api.clearMobilePasswordReturn(null)
  await api.rememberMobilePasswordReturn('guest@example.invalid', null, requestedAt)
  assert.equal((await api.readMobilePasswordReturn(null, requestedAt + 1))?.email, 'guest@example.invalid')
  assert.throws(() => api.passwordReturnStorageKey(0))
  await assert.rejects(api.rememberMobilePasswordReturn('invalid', null, requestedAt))
})

test('fulfilled but silent hint writes must be confirmed before returning success', async () => {
  const { api, stored, silentWrites } = boot(), key = api.passwordReturnStorageKey(null)
  silentWrites(true)
  await assert.rejects(api.rememberMobilePasswordReturn('guest@example.invalid', null, requestedAt), /could not be confirmed/)
  stored.set(key, { schema: 1, owner: null, email: 'older@example.invalid', requestedAt: requestedAt - 1 })
  await assert.rejects(api.rememberMobilePasswordReturn('guest@example.invalid', null, requestedAt), /could not be confirmed/)
  silentWrites(false)
  await api.rememberMobilePasswordReturn('guest@example.invalid', null, requestedAt)
  assert.equal((await api.readMobilePasswordReturn(null, requestedAt + 1))?.email, 'guest@example.invalid')
})

test('silent deletion cannot acknowledge consumption or clearing and leaves other owners intact', async () => {
  const { api, stored, silentDeletes } = boot()
  await api.rememberMobilePasswordReturn('guest@example.invalid', null, requestedAt)
  await api.rememberMobilePasswordReturn('member@example.invalid', 71, requestedAt)
  silentDeletes(true)
  await assert.rejects(api.consumeMobilePasswordReturn(null, requestedAt + 1), /not removed/)
  await assert.rejects(api.clearMobilePasswordReturn(null), /not removed/)
  assert.equal((stored.get(api.passwordReturnStorageKey(null)) as any).email, 'guest@example.invalid')
  assert.equal((await api.readMobilePasswordReturn(71, requestedAt + 1))?.email, 'member@example.invalid')
  silentDeletes(false)
  assert.equal((await api.consumeMobilePasswordReturn(null, requestedAt + 2))?.email, 'guest@example.invalid')
  assert.equal(await api.consumeMobilePasswordReturn(null, requestedAt + 3), null)
})

test('readback exceptions reject writes and do not return hints when deletion is unconfirmed', async () => {
  const { api, failReads, failVerification } = boot()
  failReads(true)
  await assert.rejects(api.rememberMobilePasswordReturn('guest@example.invalid', null, requestedAt), /read unavailable/)
  failReads(false); failVerification(true)
  await assert.rejects(api.consumeMobilePasswordReturn(null, requestedAt + 1), /presence unavailable/)
  await assert.rejects(api.clearMobilePasswordReturn(null), /presence unavailable/)
  failVerification(false)
  await api.clearMobilePasswordReturn(null)
  await api.rememberMobilePasswordReturn('fresh@example.invalid', null, requestedAt + 2)
  assert.equal((await api.consumeMobilePasswordReturn(null, requestedAt + 3))?.email, 'fresh@example.invalid')
})

test('decoded null or malformed records still require raw absence confirmation when consumed', async () => {
  const { api, stored, holdReads, silentDeletes } = boot(), key = api.passwordReturnStorageKey(null)
  stored.set(key, 'null')
  holdReads(async () => null)
  silentDeletes(true)
  await assert.rejects(api.consumeMobilePasswordReturn(null, requestedAt + 1), /not removed/)
  holdReads(null)
  stored.set(key, { schema: 2, owner: null, email: 'guest@example.invalid', requestedAt })
  await assert.rejects(api.readMobilePasswordReturn(null, requestedAt + 1), /not removed/)
  silentDeletes(false)
  assert.equal(await api.readMobilePasswordReturn(null, requestedAt + 1), null)
})
