import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { effectScope, ref } from 'vue'
import type { DailyFortuneResponse } from '../src/services/tarotAiReading'
import { previousMobileBusinessDate, validMobileDailySnapshot, validMobileYesterdayCache, type MobileDailySnapshot } from '../src/mobile/mobileYesterdayModel'

// Bundle the real composable, API adapter and validators. Only the native storage
// and authenticated HTTP boundaries are replaced; every request still passes the
// production API response validator.
const [composableBuild, apiBuild] = await Promise.all([
  '../src/mobile/useMobileYesterdayFortune.ts', '../src/mobile/mobileDailyApi.ts',
].map(entry => build({
  entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], bundle: true,
  write: false, platform: 'node', format: 'cjs', external: ['vue'],
  plugins: [{ name: 'yesterday-boundaries', setup(builder) {
    builder.onResolve({ filter: /^\.\/mobile(?:Api|Storage)$/ }, args => ({ path: args.path, namespace: 'yesterday-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'yesterday-test' }, args => ({ contents: args.path === './mobileApi'
      ? 'export const mobileError = (_cause, fallback) => fallback; export const mobileApi = { get: path => __yesterdayTest.get(path), post: (...args) => __yesterdayTest.post(...args) };'
      : 'export const mobileSite = "domestic"; export const readMobileValue = key => __yesterdayTest.read(key); export const writeMobileValue = (key, value) => __yesterdayTest.write(key, value);',
    }))
  } }],
})))
const require = createRequire(import.meta.url)
type Boundary = {
  get(path: string): Promise<{ data: { data: unknown } }>
  post(...args: unknown[]): Promise<never>
  read(key: string): Promise<unknown>
  write(key: string, value: unknown): Promise<void>
}
function load<T>(source: string, boundary: Boundary): T {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', '__yesterdayTest', source)(require, module, module.exports, boundary)
  return module.exports as T
}
function window() { return { businessDate: '2031-01-01', resetsAt: new Date(Date.now() + 3_600_000).toISOString(), timeZone: 'Asia/Shanghai' } }
function result(date = '2030-12-31', timeZone = 'Asia/Shanghai'): MobileDailySnapshot {
  return { businessDate: date, timeZone, cached: true,
    card: { id: 17, name: '星星', nameEn: 'The Star', isReversed: true },
    result: { cardName: '星星', cardNameEn: 'The Star', isReversed: true,
      sections: { intro: '从照顾自己开始。', overall: '放慢速度。', love: '平和地表达。', career: '专注手边的事。', wealth: '检查预算。', health: '留出休息时间。', mystery: '耐心也是力量。' },
      ratings: { overall: 3, love: 4, career: 2, wealth: 5, health: 1 } },
  }
}
const saved = (snapshot = result(), owner = 7, site = 'domestic') => ({ schema: 1, owner, site, snapshot })
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const http = (data: unknown) => ({ data: { data } })
const settle = async () => { for (let index = 0; index < 4; index++) await new Promise<void>(resolve => setImmediate(resolve)) }
function boot(storage = new Map<string, string>(), overrides: Partial<Boundary> = {}, connected = true, initialToday: DailyFortuneResponse | null = { ...window(), cached: false, card: null, result: null }) {
  const calls: Array<{ method: string; path: string }> = [], writes: Array<{ key: string; value: unknown }> = [], reads: string[] = []
  const boundary: Boundary = {
    get: async path => { calls.push({ method: 'GET', path }); return http(result()) },
    post: async path => { calls.push({ method: 'POST', path: String(path) }); throw new Error('Yesterday must never generate') },
    read: async key => { reads.push(key); return JSON.parse(storage.get(key) ?? 'null') },
    write: async (key, value) => { writes.push({ key, value: structuredClone(value) }); if (value === null) storage.delete(key); else storage.set(key, JSON.stringify(value)) },
    ...overrides,
  }
  const owner = ref<number | null>(7), ready = ref(true), online = ref(connected), today = ref<DailyFortuneResponse | null>(initialToday)
  const scope = effectScope()
  const yesterday = scope.run(() => load<typeof import('../src/mobile/useMobileYesterdayFortune')>(composableBuild!.outputFiles[0]!.text, boundary).useMobileYesterdayFortune({ owner, ready, online, today }))!
  return { yesterday, owner, ready, online, today, scope, calls, writes, reads, storage, boundary }
}

test('previous business dates cross calendar boundaries independently of device timezone and DST', () => {
  for (const [current, previous] of [
    ['2026-11-01', '2026-10-31'], ['2026-01-01', '2025-12-31'],
    ['2024-03-01', '2024-02-29'], ['2025-03-01', '2025-02-28'],
    ['2024-03-11', '2024-03-10'], ['2024-11-04', '2024-11-03'],
  ]) assert.equal(previousMobileBusinessDate(current!), previous)
  for (const invalid of ['', '2025-02-29', '2024-02-30', '2024-2-01', '2024-01-01T00:00:00Z']) assert.equal(previousMobileBusinessDate(invalid), null)
})

test('snapshot/cache validation rejects incomplete or mismatched card-result pairs and foreign cache scopes', () => {
  const full = result(), cache = saved(full)
  assert.equal(validMobileDailySnapshot(full, '2030-12-31', 'Asia/Shanghai'), true)
  assert.equal(validMobileYesterdayCache(JSON.parse(JSON.stringify(cache)), 7, 'domestic', '2030-12-31', 'Asia/Shanghai'), true)
  const malformed: unknown[] = [
    { ...full, card: null }, { ...full, result: null }, { ...full, cached: false },
    { ...full, card: { ...full.card!, isReversed: false } },
    { ...full, card: { ...full.card!, name: '太阳' } },
    { ...full, result: { ...full.result!, cardNameEn: 'The Sun' } },
    { ...full, result: { ...full.result!, sections: { ...full.result!.sections, love: '' } } },
    { ...full, result: { ...full.result!, ratings: { ...full.result!.ratings, health: 0 } } },
    { ...full, card: { ...full.card!, id: 78 } },
  ]
  for (const value of malformed) assert.equal(validMobileDailySnapshot(value, '2030-12-31', 'Asia/Shanghai'), false)
  for (const value of [null, { ...cache, schema: 2 }, { ...cache, owner: 8 }, { ...cache, site: 'overseas' },
    saved({ ...full, businessDate: '2030-12-30' }), saved({ ...full, timeZone: 'UTC' }),
    saved({ ...full, cached: false, card: null, result: null }),
  ]) assert.equal(validMobileYesterdayCache(value, 7, 'domestic', '2030-12-31', 'Asia/Shanghai'), false)
})

test('the real yesterday API issues one read-only GET and validates the exact server business date and zone', async () => {
  const app = boot()
  try {
    const api = load<typeof import('../src/mobile/mobileDailyApi')>(apiBuild!.outputFiles[0]!.text, app.boundary)
    assert.deepEqual(await api.fetchMobileYesterdayFortune('2030-12-31', 'Asia/Shanghai'), result())
    assert.deepEqual(app.calls, [{ method: 'GET', path: '/readings/daily-fortune/yesterday' }])
    await assert.rejects(api.fetchMobileYesterdayFortune('2030-12-30', 'Asia/Shanghai'), /Invalid yesterday/)
    await assert.rejects(api.fetchMobileYesterdayFortune('2030-12-31', 'UTC'), /Invalid yesterday/)
    assert.equal(app.calls.every(call => call.method === 'GET'), true)
  } finally { app.scope.stop() }
})

test('opening and retrying are deduplicated while busy and persist only yesterday JSON without changing today', async () => {
  const pending = deferred<ReturnType<typeof http>>()
  let requests = 0
  const app = boot(undefined, { get: () => { requests++; return pending.promise } })
  const todayBefore = JSON.stringify(app.today.value)
  try {
    const first = app.yesterday.show(), second = app.yesterday.show(), third = app.yesterday.retry()
    assert.equal(app.yesterday.open.value, true)
    assert.equal(app.yesterday.busy.value, true)
    await settle()
    assert.equal(app.reads.length, 1)
    assert.equal(requests, 1)
    pending.resolve(http(result()))
    await Promise.all([first, second, third])
    assert.deepEqual(app.yesterday.response.value, result())
    assert.equal(app.yesterday.busy.value, false)
    assert.equal(app.yesterday.cached.value, false)
    assert.deepEqual(JSON.parse(app.storage.get('daily-yesterday-7')!), saved())
    assert.deepEqual([...app.storage.keys()], ['daily-yesterday-7'])
    assert.equal(JSON.stringify(app.today.value), todayBefore)
  } finally { app.scope.stop() }
})

test('each online opening refreshes once and a failed refresh preserves a previously displayed local result', async () => {
  const storage = new Map([['daily-yesterday-7', JSON.stringify(saved())]]), app = boot(storage)
  try {
    await app.yesterday.show()
    app.yesterday.close()
    await app.yesterday.show()
    assert.equal(app.calls.length, 2)
    app.yesterday.close()
    app.boundary.get = async path => { app.calls.push({ method: 'GET', path }); throw new Error('Network unavailable') }
    await app.yesterday.show()
    assert.equal(app.calls.length, 3)
    assert.deepEqual(app.yesterday.response.value, result())
    assert.equal(app.yesterday.cached.value, true)
    assert.match(app.yesterday.error.value, /网络.*重试/)
    assert.deepEqual(JSON.parse(storage.get('daily-yesterday-7')!), saved())
  } finally { app.scope.stop() }
})

test('offline viewing restores a complete matching result without network or storage writes', async () => {
  const app = boot(new Map([['daily-yesterday-7', JSON.stringify(saved())]]), {}, false)
  try {
    await app.yesterday.show()
    assert.deepEqual(app.yesterday.response.value, result())
    assert.equal(app.yesterday.cached.value, true)
    assert.equal(app.yesterday.error.value, '')
    assert.deepEqual(app.calls, [])
    assert.deepEqual(app.writes, [])
  } finally { app.scope.stop() }
})

test('offline absence and wrong owner, site, date, zone, schema or incomplete cached results ask for a connection', async () => {
  const full = saved()
  for (const value of [null, { ...full, owner: 8 }, { ...full, site: 'overseas' }, { ...full, schema: 2 },
    saved({ ...result(), businessDate: '2030-12-30' }), saved({ ...result(), timeZone: 'UTC' }),
    saved({ ...result(), card: null, result: null, cached: false }),
  ]) {
    const app = boot(new Map([['daily-yesterday-7', JSON.stringify(value)]]), {}, false)
    try {
      await app.yesterday.show()
      assert.equal(app.yesterday.response.value, null)
      assert.equal(app.yesterday.cached.value, false)
      assert.match(app.yesterday.error.value, /离线.*联网/)
      assert.equal(app.calls.length, 0)
    } finally { app.scope.stop() }
  }
})

test('a confirmed server empty replaces a stale cache and removes its owner-specific key', async () => {
  const empty = { ...result(), card: null, result: null, cached: false }
  const app = boot(new Map([['daily-yesterday-7', JSON.stringify(saved())]]), { get: async () => http(empty) })
  try {
    await app.yesterday.show()
    assert.deepEqual(app.yesterday.response.value, empty)
    assert.equal(app.yesterday.cached.value, false)
    assert.equal(app.yesterday.error.value, '')
    assert.equal(app.storage.has('daily-yesterday-7'), false)
    assert.deepEqual(app.writes, [{ key: 'daily-yesterday-7', value: null }])
  } finally { app.scope.stop() }
})

test('a valid current today window and signed-in ready owner are required before opening or reading', async () => {
  const app = boot()
  const full = app.today.value!
  try {
    const checks = [() => { app.owner.value = null }, () => { app.owner.value = 0 },
      () => { app.owner.value = 7; app.ready.value = false },
      () => { app.ready.value = true; app.today.value = null },
      () => { app.today.value = { ...full, resetsAt: new Date(Date.now() - 1).toISOString() } },
      () => { app.today.value = { ...full, businessDate: '2031-02-30' } },
    ]
    for (const change of checks) {
      change(); await app.yesterday.show()
      assert.equal(app.yesterday.open.value, false)
      assert.equal(app.yesterday.response.value, null)
    }
    assert.equal(app.calls.length, 0)
    assert.equal(app.reads.length, 0)
  } finally { app.scope.stop() }
})

test('close, account changes, sign-out, session unreadiness, window changes and disposal invalidate late HTTP results', async () => {
  const changes: Array<(app: ReturnType<typeof boot>) => void> = [
    app => app.yesterday.close(), app => { app.owner.value = 8 }, app => { app.owner.value = null },
    app => { app.ready.value = false }, app => { app.today.value = null },
    app => { app.today.value = { ...app.today.value!, businessDate: '2031-01-02' } },
    app => { app.today.value = { ...app.today.value!, resetsAt: new Date(Date.now() + 7_200_000).toISOString() } },
    app => { app.today.value = { ...app.today.value!, timeZone: 'UTC' } }, app => app.scope.stop(),
  ]
  for (const change of changes) {
    const pending = deferred<ReturnType<typeof http>>(), app = boot(undefined, { get: () => pending.promise })
    try {
      const showing = app.yesterday.show(); await settle()
      change(app)
      assert.equal(app.yesterday.open.value, false, 'scope invalidation must close synchronously')
      pending.resolve(http(result())); await showing
      assert.equal(app.yesterday.response.value, null)
      assert.equal(app.yesterday.busy.value, false)
      assert.equal(app.writes.length, 0)
      assert.equal(app.storage.size, 0)
    } finally { app.scope.stop() }
  }
})

test('a late cache read after closing cannot reopen the result or start a request', async () => {
  const pending = deferred<unknown>(), app = boot(undefined, { read: () => pending.promise })
  try {
    const showing = app.yesterday.show()
    app.yesterday.close()
    pending.resolve(saved()); await showing
    assert.equal(app.yesterday.open.value, false)
    assert.equal(app.yesterday.response.value, null)
    assert.equal(app.calls.length, 0)
    assert.equal(app.writes.length, 0)
  } finally { app.scope.stop() }
})

test('a same-day today result refresh keeps yesterday open and does not affect the current read', async () => {
  const pending = deferred<ReturnType<typeof http>>(), app = boot(undefined, { get: () => pending.promise })
  try {
    const showing = app.yesterday.show(); await settle()
    app.today.value = { ...app.today.value!, ...result(app.today.value!.businessDate) }
    assert.equal(app.yesterday.open.value, true)
    pending.resolve(http(result())); await showing
    assert.deepEqual(app.yesterday.response.value, result())
    assert.equal(app.writes.length, 1)
  } finally { app.scope.stop() }
})

test('midnight expiry blocks late commits even before the today timer publishes a new window', async () => {
  const pending = deferred<ReturnType<typeof http>>(), app = boot(undefined, { get: () => pending.promise })
  const originalNow = Date.now
  try {
    const showing = app.yesterday.show(); await settle()
    Date.now = () => Date.parse(app.today.value!.resetsAt) + 1
    pending.resolve(http(result())); await showing
    assert.equal(app.yesterday.open.value, false)
    assert.equal(app.yesterday.response.value, null)
    assert.equal(app.writes.length, 0)
    assert.equal(app.yesterday.busy.value, false)
  } finally { Date.now = originalNow; app.scope.stop() }
})

test('an old account request cannot overwrite a newly opened account result', async () => {
  const old = deferred<ReturnType<typeof http>>(), fresh = deferred<ReturnType<typeof http>>()
  let requests = 0
  const app = boot(undefined, { get: () => ++requests === 1 ? old.promise : fresh.promise })
  try {
    const first = app.yesterday.show(); await settle()
    app.owner.value = 8
    const second = app.yesterday.show(); await settle()
    fresh.resolve(http(result())); await second
    old.resolve(http(result())); await first
    assert.equal(app.yesterday.open.value, true)
    assert.deepEqual(app.yesterday.response.value, result())
    assert.deepEqual(app.writes.map(write => write.key), ['daily-yesterday-8'])
    assert.equal(app.storage.has('daily-yesterday-7'), false)
    assert.equal(JSON.parse(app.storage.get('daily-yesterday-8')!).owner, 8)
  } finally { app.scope.stop() }
})

test('storage failures do not prevent the real API read or hide an accepted server result', async () => {
  const app = boot(undefined, {
    read: async () => { throw new Error('Storage unavailable') },
    write: async () => { throw new Error('Storage unavailable') },
  })
  try {
    await app.yesterday.show()
    assert.equal(app.calls.length, 1)
    assert.deepEqual(app.yesterday.response.value, result())
    assert.equal(app.yesterday.error.value, '')
  } finally { app.scope.stop() }
})
