import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { effectScope, ref } from 'vue'
import type { User } from '../src/stores/auth'
import { mergeMobileQuota, redemptionCodeError, validMobileRedemption } from '../src/mobile/mobileMembershipModel'

// Exercise the real composable, authenticated API and validators together. Only
// HTTP and native storage are replaced; the HTTP double runs API interceptors.
const bundled = await build({
  stdin: {
    contents: 'export * from "./useMobileMembership"; export * from "./mobileApi";',
    resolveDir: fileURLToPath(new URL('../src/mobile/', import.meta.url)),
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
  define: { 'import.meta.env': JSON.stringify({ PROD: false, VITE_PUBLIC_API_ORIGIN: 'https://membership.test' }) },
  plugins: [{ name: 'membership-boundaries', setup(builder) {
    builder.onResolve({ filter: /^(axios|\.\/mobileStorage)$/ }, args => ({ path: args.path, namespace: 'membership-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'membership-test' }, args => ({ contents: args.path === './mobileStorage'
      ? 'export const mobileSite = "domestic"; export const readMobileValue = key => __membershipTest.read(key); export const writeMobileValue = (key, value) => __membershipTest.write(key, value);'
      : `export class AxiosHeaders {
          static from(value) { return value instanceof AxiosHeaders ? value : new AxiosHeaders(); }
          set() {}
        }
        const axios = {
          isAxiosError: error => !!error?.isAxiosError,
          create() {
            let requestHandler, successHandler, failureHandler;
            const client = async initial => {
              const config = requestHandler ? await requestHandler(initial) : initial;
              try {
                const response = { ...await __membershipTest.request(config.method, config.url, config.data), config };
                return successHandler ? successHandler(response) : response;
              } catch (error) {
                if (error && typeof error === 'object') error.config ??= config;
                if (failureHandler) return failureHandler(error);
                throw error;
              }
            };
            for (const method of ['get', 'post', 'put', 'delete']) client[method] = (url, data, config) => client({ ...(method === 'get' || method === 'delete' ? data : config), method: method.toUpperCase(), url, data: method === 'get' || method === 'delete' ? undefined : data });
            client.interceptors = { request: { use(handler) { requestHandler = handler; } }, response: { use(success, failure) { successHandler = success; failureHandler = failure; } } };
            return client;
          }
        }; export default axios;`,
    }))
  } }],
})
type Api = typeof import('../src/mobile/mobileApi') & typeof import('../src/mobile/useMobileMembership')
type HttpResponse = { data: { data: unknown } }
type Call = { method: string; path: string; body: unknown }
type Boundary = {
  request(method: string, path: string, body?: unknown): Promise<HttpResponse>
  read(key: string): Promise<unknown>
  write(key: string, value: unknown): Promise<void>
}
const require = createRequire(import.meta.url)
const http = (data: unknown): HttpResponse => ({ data: { data } })
const user = (overrides: Partial<User> = {}): User => ({
  id: 7, email: 'member@example.test', username: 'member', nickname: 'Member', avatar: '', gender: '',
  birthday: null, zodiacSign: null, location: null, bio: null, membership: 'free', membershipExpiresAt: null,
  remainingFreeQuota: 3, createdAt: '2026-01-01T00:00:00Z', ...overrides,
})
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (cause: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const settle = async () => { for (let index = 0; index < 4; index++) await new Promise<void>(resolve => setImmediate(resolve)) }
async function boot(overrides: Partial<Boundary> = {}, initial: { owner?: number | null; ready?: boolean; online?: boolean; english?: boolean; signedIn?: boolean } = {}) {
  const calls: Call[] = [], writes: Array<{ key: string; value: unknown }> = []
  const storage = new Map<string, unknown>()
  if (initial.signedIn !== false) storage.set('session', { user: user(), accessToken: 'test-access', refreshToken: 'test-refresh', site: 'domestic' })
  const boundary: Boundary = {
    request: async (_method, path) => {
      if (path === '/invitations/redeem') return http({ type: 'vip_days', value: 30 })
      if (path === '/user/profile') return http(user())
      if (path === '/user/quota') return http({ membership: 'vip', membershipExpiresAt: '2036-01-01T00:00:00Z', remaining: 0 })
      throw new Error(`Unexpected request: ${path}`)
    },
    read: async key => structuredClone(storage.get(key) ?? null),
    write: async (key, value) => { writes.push({ key, value: structuredClone(value) }); storage.set(key, structuredClone(value)) },
    ...overrides,
  }
  const module = { exports: {} }
  const recorded: Boundary = { ...boundary, request: async (method, path, body) => { calls.push({ method, path, body }); return boundary.request(method, path, body) } }
  new Function('require', 'module', 'exports', '__membershipTest', bundled.outputFiles[0]!.text)(require, module, module.exports, recorded)
  const api = module.exports as Api
  await api.initializeMobileSession(false)
  const owner = ref<number | null>(initial.owner === undefined ? initial.signedIn === false ? null : 7 : initial.owner)
  const ready = ref(initial.ready ?? true), online = ref(initial.online ?? true), english = ref(initial.english ?? false)
  const scope = effectScope()
  const membership = scope.run(() => api.useMobileMembership({ owner, ready, online, english }))!
  const redemptionCalls = () => calls.filter(call => call.path === '/invitations/redeem')
  return { api, membership, owner, ready, online, english, scope, boundary, calls, writes, storage, redemptionCalls }
}

test('redemption validation accepts trimmed supported codes and only known positive grants', () => {
  for (const code of ['ABCD', '  Ab_c-09  ', 'a'.repeat(50)]) assert.equal(redemptionCodeError(code), '')
  for (const code of ['', '   ', 'abc', 'a'.repeat(51), 'AB CD', '兑换码123', 'ABCD\nEF']) {
    assert.notEqual(redemptionCodeError(code), '')
    assert.notEqual(redemptionCodeError(code, true), '')
  }
  for (const type of ['vip_days', 'quota']) {
    for (const value of [1, 30, 3650]) assert.equal(validMobileRedemption({ type, value }), true)
    for (const value of [0, -1, 1.5, 3651, '30', NaN, Infinity]) assert.equal(validMobileRedemption({ type, value }), false)
  }
  for (const value of [null, {}, [], { type: 'vip', value: 30 }]) assert.equal(validMobileRedemption(value), false)
})

test('quota merge preserves zero quota and both active and expired VIP expiry dates', () => {
  const base = user(), before = structuredClone(base)
  for (const membershipExpiresAt of ['2036-01-01T00:00:00Z', '2020-01-01T00:00:00Z']) {
    assert.deepEqual(mergeMobileQuota(base, { remaining: 0, membership: 'vip', membershipExpiresAt }), {
      ...base, remainingFreeQuota: 0, membership: 'vip', membershipExpiresAt,
    })
  }
  assert.deepEqual(mergeMobileQuota(user({ membership: 'vip', membershipExpiresAt: '2020-01-01T00:00:00Z' }), {
    remaining: 2, membership: 'free', membershipExpiresAt: null,
  }), { ...base, remainingFreeQuota: 2 })
  assert.deepEqual(base, before, 'merging must not mutate the source profile')
})

test('malformed quota fields cannot overwrite valid profile fields', () => {
  const base = user({ membership: 'vip', membershipExpiresAt: '2036-01-01T00:00:00Z', remainingFreeQuota: 9 })
  for (const quota of [null, undefined, false, 'bad', [], {},
    { remaining: -1, membership: 'admin', membershipExpiresAt: null },
    { remaining: '0', membership: 'vip', membershipExpiresAt: 'not-a-date' },
    { remaining: 1.5, membership: 'free' },
    { remaining: Number.MAX_SAFE_INTEGER + 1, membership: 'vip', membershipExpiresAt: 1 },
  ]) assert.deepEqual(mergeMobileQuota(base, quota), base)
  assert.deepEqual(mergeMobileQuota(base, { remaining: 0, membership: 'vip', membershipExpiresAt: 'broken' }), { ...base, remainingFreeQuota: 0 })
})

test('signed-out or unready sessions cannot open the redemption dialog or make requests', async () => {
  for (const initial of [{ signedIn: false }, { ready: false }]) {
    const app = await boot({}, initial)
    try {
      app.membership.show(); app.membership.code.value = 'CODE-1234'
      await app.membership.redeem(); await app.membership.refresh()
      assert.equal(app.membership.open.value, false)
      assert.deepEqual(app.calls, [])
    } finally { app.scope.stop() }
  }
})

test('invalid input never posts and accepted input is trimmed by the real API', async () => {
  const app = await boot()
  try {
    app.membership.show()
    for (const code of ['', '  ', 'abc', 'bad code', 'a'.repeat(51), '邀请码']) {
      app.membership.code.value = code; await app.membership.redeem()
      assert.notEqual(app.membership.error.value, '')
      assert.deepEqual(app.calls, [])
    }
    app.membership.code.value = '  Ab_C-1234  '
    assert.equal(app.membership.error.value, '', 'editing a rejected input should clear its previous error')
    await app.membership.redeem()
    assert.deepEqual(app.redemptionCalls(), [{ method: 'POST', path: '/invitations/redeem', body: { code: 'Ab_C-1234' } }])
    assert.deepEqual(app.membership.grant.value, { type: 'vip_days', value: 30 })
    assert.equal(app.membership.code.value, '')
    assert.equal(app.membership.profileUpdated.value, true)
    assert.equal(app.api.mobileUser.value!.membership, 'vip')
    assert.equal(app.api.mobileUser.value!.remainingFreeQuota, 0)
  } finally { app.scope.stop() }
})

test('simultaneous submissions and refreshes send only one redemption POST', async () => {
  const pending = deferred<HttpResponse>()
  const app = await boot({ request: async (_method, path) => path === '/invitations/redeem' ? pending.promise : http(path === '/user/profile' ? user() : {}) })
  try {
    app.membership.show(); app.membership.code.value = 'CODE-1234'
    const first = app.membership.redeem(), second = app.membership.redeem(), refresh = app.membership.refresh()
    assert.equal(app.membership.busy.value, true)
    await settle()
    assert.equal(app.redemptionCalls().length, 1)
    assert.equal(app.calls.length, 1)
    pending.resolve(http({ type: 'quota', value: 5 }))
    await Promise.all([first, second, refresh])
    await app.membership.redeem()
    assert.equal(app.redemptionCalls().length, 1, 'a completed grant cannot be submitted again')
    assert.deepEqual(app.membership.grant.value, { type: 'quota', value: 5 })
  } finally { app.scope.stop() }
})

test('offline redemption and profile refresh make no HTTP requests and retain the entered code', async () => {
  const app = await boot({}, { online: false, english: true })
  try {
    app.membership.show(); app.membership.code.value = 'CODE-1234'
    await app.membership.redeem(); await app.membership.refresh()
    assert.match(app.membership.error.value, /internet|Connect/)
    assert.match(app.membership.profileError.value, /Connect/)
    assert.equal(app.membership.code.value, 'CODE-1234')
    assert.equal(app.membership.grant.value, null)
    assert.deepEqual(app.calls, [])
    app.online.value = true; await app.membership.redeem()
    assert.equal(app.redemptionCalls().length, 1)
  } finally { app.scope.stop() }
})

test('a successful POST survives a failed profile GET; refresh retries only the GETs', async () => {
  let profileFails = true
  const app = await boot({ request: async (_method, path) => {
    if (path === '/invitations/redeem') return http({ type: 'quota', value: 20 })
    if (path === '/user/profile') { if (profileFails) throw new Error('Network unavailable'); return http(user()) }
    return http({ remaining: 23, membership: 'free', membershipExpiresAt: null })
  } })
  try {
    app.membership.show(); app.membership.code.value = 'CODE-1234'
    await app.membership.redeem()
    assert.deepEqual(app.membership.grant.value, { type: 'quota', value: 20 })
    assert.equal(app.membership.code.value, '')
    assert.equal(app.membership.error.value, '')
    assert.notEqual(app.membership.profileError.value, '')
    assert.equal(app.membership.profileUpdated.value, false)
    assert.equal(app.membership.busy.value, false)
    assert.equal(app.membership.syncing.value, false)
    await app.membership.redeem()
    assert.equal(app.redemptionCalls().length, 1)
    profileFails = false; await app.membership.refresh()
    assert.equal(app.redemptionCalls().length, 1)
    assert.equal(app.calls.filter(call => call.path === '/user/profile').length, 2)
    assert.equal(app.calls.filter(call => call.path === '/user/quota').length, 2)
    assert.equal(app.membership.profileUpdated.value, true)
    assert.equal(app.membership.profileError.value, '')
    assert.equal(app.api.mobileUser.value!.remainingFreeQuota, 23)
  } finally { app.scope.stop() }
})

test('close is deferred during redemption and refresh, then clears the completed dialog', async () => {
  const post = deferred<HttpResponse>(), profile = deferred<HttpResponse>()
  const app = await boot({ request: async (_method, path) => path === '/invitations/redeem' ? post.promise : path === '/user/profile' ? profile.promise : http({}) })
  try {
    app.membership.show(); app.membership.code.value = 'CODE-1234'
    const submitting = app.membership.redeem(); await settle()
    app.membership.close()
    assert.equal(app.membership.open.value, true)
    post.resolve(http({ type: 'vip_days', value: 7 })); await settle()
    assert.equal(app.membership.syncing.value, true)
    app.membership.close()
    assert.equal(app.membership.open.value, true)
    assert.deepEqual(app.membership.grant.value, { type: 'vip_days', value: 7 })
    profile.resolve(http(user())); await submitting
    app.membership.close()
    assert.equal(app.membership.open.value, false)
    assert.equal(app.membership.grant.value, null)
    assert.equal(app.membership.code.value, '')
    assert.equal(app.membership.profileUpdated.value, false)
  } finally { app.scope.stop() }
})

test('an explicit profile refresh is deduplicated and cannot be closed while it runs', async () => {
  const profile = deferred<HttpResponse>()
  const app = await boot({ request: async (_method, path) => path === '/user/profile' ? profile.promise : http({}) })
  try {
    app.membership.show(); app.membership.code.value = 'CODE-1234'
    const first = app.membership.refresh(), second = app.membership.refresh()
    await settle(); app.membership.close()
    assert.equal(app.membership.open.value, true)
    assert.equal(app.membership.syncing.value, true)
    assert.equal(app.calls.filter(call => call.path === '/user/profile').length, 1)
    profile.resolve(http(user())); await Promise.all([first, second])
    assert.equal(app.membership.profileUpdated.value, true)
    assert.deepEqual(app.redemptionCalls(), [])
    app.membership.close(); assert.equal(app.membership.open.value, false)
  } finally { app.scope.stop() }
})

test('owner changes, unreadiness and disposal synchronously clear codes and discard late POST grants', async () => {
  const changes: Array<(app: Awaited<ReturnType<typeof boot>>) => void> = [
    app => { app.owner.value = 8 }, app => { app.owner.value = null }, app => { app.ready.value = false }, app => app.scope.stop(),
  ]
  for (const change of changes) {
    const post = deferred<HttpResponse>()
    const app = await boot({ request: async () => post.promise })
    try {
      app.membership.show(); app.membership.code.value = 'PRIVATE-CODE'
      const submitting = app.membership.redeem(); await settle()
      change(app)
      assert.equal(app.membership.open.value, false)
      assert.equal(app.membership.code.value, '')
      assert.equal(app.membership.busy.value, false)
      post.resolve(http({ type: 'quota', value: 10 })); await submitting
      assert.equal(app.membership.grant.value, null)
      assert.equal(app.membership.error.value, '')
      assert.equal(app.membership.profileUpdated.value, false)
      assert.equal(app.calls.length, 1, 'an invalidated POST must not initiate profile sync')
    } finally { app.scope.stop() }
  }
})

test('invalidation during profile synchronization discards late success and failure UI state', async () => {
  for (const failure of [false, true]) {
    const profile = deferred<HttpResponse>()
    const app = await boot({ request: async (_method, path) => path === '/invitations/redeem' ? http({ type: 'vip_days', value: 7 }) : path === '/user/profile' ? profile.promise : http({}) })
    try {
      app.membership.show(); app.membership.code.value = 'CODE-1234'
      const submitting = app.membership.redeem(); await settle()
      assert.equal(app.membership.syncing.value, true)
      app.ready.value = false
      if (failure) profile.reject(new Error('Late network error')); else profile.resolve(http(user()))
      await submitting
      assert.equal(app.membership.open.value, false)
      assert.equal(app.membership.code.value, '')
      assert.equal(app.membership.grant.value, null)
      assert.equal(app.membership.syncing.value, false)
      assert.equal(app.membership.profileUpdated.value, false)
      assert.equal(app.membership.profileError.value, '')
    } finally { app.scope.stop() }
  }
})

test('real redemption API rejects signed-out, invalid-grant and stale-session responses', async () => {
  const signedOut = await boot({}, { signedIn: false })
  try {
    await assert.rejects(signedOut.api.redeemMobileInvitation('CODE-1234'), /Account changed/)
    assert.deepEqual(signedOut.calls, [])
  } finally { signedOut.scope.stop() }
  for (const value of [null, { type: 'quota', value: 0 }, { type: 'vip_days', value: '7' }, { type: 'admin', value: 7 }]) {
    const app = await boot({ request: async () => http(value) })
    try { await assert.rejects(app.api.redeemMobileInvitation('CODE-1234'), /Invalid redemption response/) }
    finally { app.scope.stop() }
  }
  const post = deferred<HttpResponse>(), app = await boot({ request: async () => post.promise })
  try {
    const submitting = app.api.redeemMobileInvitation('CODE-1234'); await settle()
    await app.api.forgetMobileSession()
    post.resolve(http({ type: 'quota', value: 7 }))
    await assert.rejects(submitting, /Account changed/)
    assert.equal(app.api.mobileUser.value, null)
  } finally { app.scope.stop() }
})

test('known redemption errors use localized messages and can be corrected without losing the code', async () => {
  for (const english of [false, true]) {
    const app = await boot({ request: async () => { throw { isAxiosError: true, response: { status: 400, data: { code: 'INVITATION_EXPIRED' } } } } }, { english })
    try {
      app.membership.show(); app.membership.code.value = 'CODE-1234'
      await app.membership.redeem()
      assert.match(app.membership.error.value, english ? /expired/ : /过期/)
      assert.equal(app.membership.code.value, 'CODE-1234')
      assert.equal(app.membership.grant.value, null)
      assert.equal(app.membership.busy.value, false)
      assert.equal(app.calls.length, 1)
      app.membership.code.value = 'NEXT-1234'
      assert.equal(app.membership.error.value, '')
    } finally { app.scope.stop() }
  }
})
