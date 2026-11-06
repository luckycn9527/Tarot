import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/mobile/mobileStorage.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'isolated-raw-storage', setup(builder) {
    builder.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'core', namespace: 'raw-storage-test' }))
    builder.onResolve({ filter: /^@aparajita\/capacitor-secure-storage$/ }, () => ({ path: 'secure', namespace: 'raw-storage-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'raw-storage-test' }, args => ({ contents: args.path === 'core'
      ? 'export const Capacitor={isNativePlatform:()=>__fixture.native};'
      : 'export const KeychainAccess={whenUnlockedThisDeviceOnly:1};export const SecureStorage={setKeyPrefix:async()=>{},setSynchronize:async()=>{},setDefaultKeychainAccess:async()=>{},get:key=>__fixture.get(key),getItem:key=>__fixture.getItem(key),remove:key=>__fixture.remove(key),set:(key,value)=>__fixture.set(key,value)};' }))
  } }],
})
function boot(native = false) {
  const data = new Map<string, string>()
  const fixture = {
    native, silent: false, unreadable: false,
    get: async (key: string) => {
      if (fixture.unreadable) throw new Error('Fixture read unavailable')
      const raw = data.get(key)
      return raw === undefined ? null : JSON.parse(raw)
    },
    getItem: async (key: string) => { if (fixture.unreadable) throw new Error('Fixture read unavailable'); return data.get(key) ?? null },
    remove: async (key: string) => { if (fixture.silent) return false; data.delete(key); return true },
    set: async (key: string, value: string) => { data.set(key, value); return true },
  }
  const storage = { getItem: (key: string) => data.get(key) ?? null, removeItem: (key: string) => { if (!fixture.silent) data.delete(key) }, setItem: (key: string, value: string) => data.set(key, value) }
  const module = { exports: {} }
  new Function('module', 'exports', '__fixture', 'sessionStorage', compiled.outputFiles[0]!.text)(module, module.exports, fixture, storage)
  return { api: module.exports as typeof import('../src/mobile/mobileStorage'), data, fixture }
}

test('raw verification distinguishes absent storage from JSON-null, false or corrupt stored data', async () => {
  for (const native of [false, true]) {
    const { api, data } = boot(native)
    const rawKey = native ? 'daily-71' : 'etomd-mobile-v1-domestic:daily-71'
    for (const raw of ['null', 'false', '{malformed']) {
      data.set(rawKey, raw)
      if (native && raw === 'null') assert.equal(await api.readMobileValue('daily-71'), null, 'the SDK get() decodes stored JSON null')
      await assert.rejects(api.verifyMobileValueRemoved('daily-71'))
    }
    data.delete(rawKey)
    await api.verifyMobileValueRemoved('daily-71')
  }
})

test('a native remove returning false cannot hide retained secure data', async () => {
  const { api, data, fixture } = boot(true)
  data.set('daily-71', JSON.stringify({ saved: true })); fixture.silent = true
  await api.writeMobileValue('daily-71', null)
  await assert.rejects(api.verifyMobileValueRemoved('daily-71'))
  assert.ok(data.has('daily-71'))
})

test('native read errors leave cleanup unconfirmed rather than pretending absence', async () => {
  const { api, fixture } = boot(true)
  await api.writeMobileValue('daily-71', null)
  fixture.unreadable = true
  await assert.rejects(api.verifyMobileValueRemoved('daily-71'))
})

test('selected verification also detects a browser removal silently ignored by storage', async () => {
  const { api, data, fixture } = boot()
  data.set('etomd-mobile-v1-domestic:daily-71', '{}'); fixture.silent = true
  await api.writeMobileValue('daily-71', null)
  await assert.rejects(api.verifyMobileValueRemoved('daily-71'))
})

test('verification waits for queued removals and succeeds only after raw storage is absent', async () => {
  const { api, data, fixture } = boot(true)
  data.set('daily-71', '{}')
  let release!: () => void, confirmed = false
  fixture.remove = async key => { await new Promise<void>(resolve => { release = resolve }); data.delete(key); return true }
  const removing = api.writeMobileValue('daily-71', null)
  const confirming = api.verifyMobileValueRemoved('daily-71').then(() => { confirmed = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(confirmed, false)
  release(); await Promise.all([removing, confirming])
  assert.equal(confirmed, true)
})
