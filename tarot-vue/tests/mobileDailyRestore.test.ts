import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { effectScope, ref, type EffectScope } from 'vue'
import type { DailyFortuneResponse } from '../src/services/tarotAiReading'
import type { MobileDailyCache } from '../src/mobile/mobileDailyModel'
import type { MobileCard } from '../src/mobile/types'

// Exercise the actual composable across fresh Vue scopes, with storage and API
// boundaries replaced. No production HTTP, browser storage or native bridge runs.
const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/mobile/useMobileDailyFortune.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
  plugins: [{ name: 'isolated-daily-boundaries', setup(builder) {
    builder.onResolve({ filter: /^\.\/mobile(?:Api|DailyApi|Storage)$/ }, args => ({ path: args.path, namespace: 'daily-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'daily-test' }, args => ({ contents:
      args.path === './mobileApi' ? 'export const mobileError = (cause, fallback) => fallback || cause.message;' :
      args.path === './mobileDailyApi' ? 'export const fetchMobileDailyFortune = () => __dailyTest.fetch(); export const generateMobileDailyFortune = card => __dailyTest.generate(card);' :
      'export const mobileSite = "domestic"; export const readMobileValue = key => __dailyTest.read(key); export const writeMobileValue = (key, value) => __dailyTest.write(key, value);',
    }))
  } }],
})
const require = createRequire(import.meta.url)
type Harness = {
  read(key: string): Promise<unknown>
  write(key: string, value: unknown): Promise<void>
  fetch(): Promise<DailyFortuneResponse>
  generate(card: MobileCard): Promise<DailyFortuneResponse>
}
const load = (harness: Harness): typeof import('../src/mobile/useMobileDailyFortune') => {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', '__dailyTest', compiled.outputFiles[0]!.text)(require, module, module.exports, harness)
  return module.exports as typeof import('../src/mobile/useMobileDailyFortune')
}
const clock = () => {
  const now = Date.now()
  return { businessDate: new Date(now).toISOString().slice(0, 10), resetsAt: new Date(now + 3_600_000).toISOString(), timeZone: 'UTC' }
}
function completed(window = clock(), id = 17, reversed = true): DailyFortuneResponse {
  return { ...window, cached: true,
    card: { id, name: '星星', nameEn: 'The Star', isReversed: reversed },
    result: { cardName: '星星', cardNameEn: 'The Star', isReversed: reversed,
      sections: { intro: '今天从照顾自己开始。', overall: '放慢速度。', love: '平和地表达。', career: '专注手边的事。', wealth: '检查预算。', health: '留出休息时间。', mystery: '耐心也是力量。' },
      ratings: { overall: 3, love: 4, career: 2, wealth: 5, health: 1 } },
  }
}
function saved(data = completed(), owner = 7): MobileDailyCache {
  return { schema: 1, owner, site: 'domestic', window: { businessDate: data.businessDate, resetsAt: data.resetsAt, timeZone: data.timeZone }, card: data.card, result: data.result, pending: null }
}
const settle = async () => { for (let index = 0; index < 8; index++) await new Promise<void>(resolve => setImmediate(resolve)) }
function boot(storage: Map<string, unknown>, overrides: Partial<Harness> = {}, initialOwner: number | null = 7, connected = false) {
  const calls: Array<{ method: string; card?: MobileCard }> = []
  const boundary: Harness = {
    read: async key => structuredClone(storage.get(key) ?? null),
    write: async (key, value) => { storage.set(key, structuredClone(value)) },
    fetch: async () => { calls.push({ method: 'GET' }); throw new Error('Offline test boundary') },
    generate: async card => { calls.push({ method: 'POST', card: { ...card } }); throw new Error('Unexpected generation') },
    ...overrides,
  }
  const owner = ref<number | null>(initialOwner), ready = ref(true), online = ref(connected), cardIds = ref<number[]>([])
  const scope: EffectScope = effectScope()
  const daily = scope.run(() => load(boundary).useMobileDailyFortune({ owner, ready, online, cardIds }))!
  return { daily, owner, ready, online, scope, calls }
}

test('a completed reversed daily draw stays revealed across cold scopes, offline and failed refresh', async () => {
  const stored = saved(), storage = new Map<string, unknown>([['daily-7', stored]])
  const first = boot(storage)
  await settle()
  assert.equal(first.daily.flipped.value, true)
  assert.deepEqual(first.daily.card.value, { id: 17, isReversed: true })
  assert.deepEqual(first.daily.response.value?.result, stored.result)
  first.scope.stop()
  const restarted = boot(storage)
  try {
    await settle()
    assert.equal(restarted.daily.flipped.value, true)
    assert.equal(restarted.daily.cached.value, true)
    assert.deepEqual(restarted.daily.response.value?.result, stored.result)
    restarted.online.value = true
    await restarted.daily.refresh()
    assert.equal(restarted.daily.flipped.value, true)
    assert.deepEqual(restarted.daily.card.value, { id: 17, isReversed: true })
    assert.equal(restarted.daily.error.value, '')
    assert.deepEqual(restarted.calls.map(call => call.method), ['GET'])
    await restarted.daily.draw()
    assert.equal(restarted.calls.length, 1, 'opening today\'s saved result must not generate again')
  } finally { restarted.scope.stop() }
})

test('an untouched, expired, foreign-account or foreign-site daily cache never reveals a card', async () => {
  const full = saved()
  const cases: Array<unknown> = [null,
    { ...full, card: null, result: null },
    { ...full, window: { ...full.window, resetsAt: new Date(Date.now() - 1000).toISOString() } },
    { ...full, owner: 8 }, { ...full, site: 'overseas' },
  ]
  for (const value of cases) {
    const app = boot(new Map([['daily-7', value]]))
    try {
      await settle()
      assert.equal(app.daily.flipped.value, false)
      assert.equal(app.daily.response.value?.result ?? null, null)
      assert.equal(app.calls.length, 0)
    } finally { app.scope.stop() }
  }
})

test('a completed server result is revealed on startup without a second tap or POST', async () => {
  const data = completed(), app = boot(new Map(), { fetch: async () => data }, 7, true)
  try {
    await settle()
    assert.equal(app.daily.flipped.value, true)
    assert.deepEqual(app.daily.card.value, { id: 17, isReversed: true })
    assert.deepEqual(app.daily.response.value?.result, data.result)
    assert.equal(app.calls.length, 0)
  } finally { app.scope.stop() }
})

test('a cold pending draw restores its original face and has a same-card retry action', async () => {
  const window = clock(), pending = { id: 42, isReversed: true }
  const storage = new Map<string, unknown>([['daily-7', { ...saved(completed(window)), card: null, result: null, pending }]])
  const methods: string[] = []
  const app = boot(storage, {
    fetch: async () => { methods.push('GET'); return { ...window, card: null, result: null, cached: false } },
    generate: async card => { methods.push('POST'); assert.deepEqual(card, pending); return completed(window, 42, true) },
  })
  try {
    await settle()
    assert.equal(app.daily.flipped.value, true)
    assert.deepEqual(app.daily.card.value, pending)
    assert.match(app.daily.error.value, /重试/)
    app.online.value = true
    await app.daily.draw()
    assert.deepEqual(methods, ['GET', 'POST'])
    assert.equal(app.daily.flipped.value, true)
    assert.deepEqual(app.daily.card.value, pending)
    assert.equal(app.daily.error.value, '')
    assert.ok(app.daily.response.value?.result)
  } finally { app.scope.stop() }
})

test('pending recovery failures keep the revealed card and cannot select a replacement', async () => {
  const pending = { id: 42, isReversed: true }
  const app = boot(new Map([['daily-7', { ...saved(), card: null, result: null, pending }]]))
  try {
    await settle()
    app.online.value = true
    await app.daily.draw()
    assert.equal(app.daily.flipped.value, true)
    assert.deepEqual(app.daily.card.value, pending)
    assert.ok(app.daily.error.value)
    assert.deepEqual(app.calls.map(call => call.method), ['GET'])
  } finally { app.scope.stop() }
})

test('account changes, sign-out and late old-account responses cannot restore a foreign face', async () => {
  const data = completed(), pending: Array<(value: DailyFortuneResponse) => void> = []
  const app = boot(new Map([['daily-7', saved(data)]]), { fetch: () => new Promise(resolve => pending.push(resolve)) }, 7, true)
  try {
    await settle()
    assert.equal(app.daily.flipped.value, true)
    app.owner.value = 8
    await settle()
    assert.equal(app.daily.flipped.value, false)
    pending[0]!(data)
    await settle()
    assert.equal(app.daily.flipped.value, false)
    assert.equal(app.daily.response.value, null)
    pending[1]!({ ...clock(), card: null, result: null, cached: false })
    await settle()
    app.owner.value = null
    assert.equal(app.daily.flipped.value, false)
    assert.equal(app.daily.response.value, null)
  } finally { app.scope.stop() }
})

test('a newly confirmed server window resets the previous revealed daily result', async () => {
  const full = saved(), next = { ...clock(), businessDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), resetsAt: new Date(Date.now() + 90_000_000).toISOString() }
  const app = boot(new Map([['daily-7', full]]), { fetch: async () => ({ ...next, card: null, result: null, cached: false }) })
  try {
    await settle()
    assert.equal(app.daily.flipped.value, true)
    app.online.value = true
    await app.daily.refresh()
    assert.equal(app.daily.flipped.value, false)
    assert.equal(app.daily.response.value?.result, null)
    assert.equal(app.daily.response.value?.businessDate, next.businessDate)
  } finally { app.scope.stop() }
})

test('the server reset timer turns a restored face back into an undrawn new day', async () => {
  const full = saved()
  full.window.resetsAt = new Date(Date.now() + 100).toISOString()
  const app = boot(new Map([['daily-7', full]]))
  try {
    await settle()
    assert.equal(app.daily.flipped.value, true)
    await new Promise(resolve => setTimeout(resolve, 140))
    assert.equal(app.daily.flipped.value, false)
    assert.equal(app.daily.response.value, null)
    assert.equal(app.calls.length, 0)
  } finally { app.scope.stop() }
})
