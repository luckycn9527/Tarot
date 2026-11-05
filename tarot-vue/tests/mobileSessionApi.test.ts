import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/mobile/mobileApi.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue', 'axios'],
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'isolated-session-storage', setup(builder) {
    builder.onResolve({ filter: /^\.\/mobileStorage$/ }, () => ({ path: 'storage', namespace: 'session-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'session-test' }, () => ({ contents: 'export const mobileSite="domestic"; export const readMobileValue=key=>__store.read(key); export const writeMobileValue=(key,value)=>__store.write(key,value);' }))
  } }],
})
const require = createRequire(import.meta.url)
const day = 86_400_000
const startedAt = Date.parse('2026-11-01T00:00:00Z')
const deadline = new Date(startedAt + 90 * day).toISOString()
const profile = { id: 71, email: 'session-qa@example.invalid', nickname: 'Session fixture', membership: 'free', remainingFreeQuota: 8 }
function credentials(accessToken = 'access-1', refreshToken = 'refresh-1') {
  return { user: profile, accessToken, refreshToken, sessionExpiresAt: deadline }
}
function response(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data: { success: true, data }, status: 200, statusText: 'OK', headers: {} }
}
function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Session expired', 'ERR_BAD_REQUEST', config, null, {
    config, data: { message: '登录已过期，请重新登录' }, status: 401, statusText: 'Unauthorized', headers: {},
  })
}
type Handler = (config: InternalAxiosRequestConfig) => ReturnType<typeof response> | Promise<ReturnType<typeof response>>
function boot(handler: Handler, stored = new Map<string, unknown>()) {
  const shim = { AxiosHeaders,
    isAxiosError: axios.isAxiosError,
    create(config: Parameters<typeof axios.create>[0]) {
      const client = axios.create(config)
      client.defaults.adapter = async request => handler(request)
      return client
    },
  }
  const module = { exports: {} }
  const storage = { read: async (key: string) => structuredClone(stored.get(key) ?? null), write: async (key: string, value: unknown) => { stored.set(key, structuredClone(value)) } }
  new Function('require', 'module', 'exports', '__store', 'window', compiled.outputFiles[0]!.text)(
    (name: string) => name === 'axios' ? shim : require(name), module, module.exports, storage,
    { location: { origin: 'https://local.fixture.invalid' } },
  )
  return { api: module.exports as typeof import('../src/mobile/mobileApi'), stored }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test('a native login remembers credentials and the server deadline, never the password', async () => {
  const { api, stored } = boot(config => {
    assert.equal(config.url, '/auth/native/login')
    assert.deepEqual(JSON.parse(config.data), { identifier: 'fixture', password: 'inert-test-password' })
    return response(config, credentials())
  })
  await api.loginMobile(' fixture ', 'inert-test-password')
  const saved = stored.get('session') as any
  assert.equal(saved.sessionExpiresAt, deadline)
  assert.equal(saved.site, 'domestic')
  assert.equal(saved.user.id, profile.id)
  assert.equal(JSON.stringify(saved).includes('inert-test-password'), false)
  assert.equal('password' in saved, false)
})

test('a cold session refreshes expired access without login and retains the original 90-day deadline', async () => {
  const stored = new Map<string, unknown>([['session', { ...credentials(), site: 'domestic' }]])
  let refreshes = 0, requests = 0
  const { api } = boot(config => {
    if (config.url === '/auth/native/refresh') {
      refreshes++
      assert.equal(JSON.parse(config.data).refreshToken, 'refresh-1')
      return response(config, credentials('access-2', 'refresh-2'))
    }
    assert.equal(config.url, '/user/profile')
    requests++
    if (config.headers.get('Authorization') === 'Bearer access-1') throw unauthorized(config)
    assert.equal(config.headers.get('Authorization'), 'Bearer access-2')
    return response(config, profile)
  }, stored)
  await api.initializeMobileSession(false)
  assert.equal(api.mobileUser.value?.id, profile.id)
  await api.mobileApi.get('/user/profile')
  assert.equal(refreshes, 1); assert.equal(requests, 2)
  assert.equal((stored.get('session') as any).sessionExpiresAt, deadline)
  assert.equal((stored.get('session') as any).refreshToken, 'refresh-2')
})

test('concurrent access failures share one refresh and both retry with the new credential', async () => {
  let complete!: () => void, refreshes = 0
  const { api } = boot(config => {
    if (config.url === '/auth/native/refresh') {
      refreshes++
      return new Promise(resolve => { complete = () => resolve(response(config, credentials('access-2', 'refresh-2'))) })
    }
    if (config.headers.get('Authorization') === 'Bearer access-1') throw unauthorized(config)
    assert.equal(config.headers.get('Authorization'), 'Bearer access-2')
    return response(config, profile)
  }, new Map([['session', { ...credentials(), site: 'domestic' }]]))
  await api.initializeMobileSession(false)
  const first = api.mobileApi.get('/user/profile'), second = api.mobileApi.get('/user/quota')
  await settle(); assert.equal(refreshes, 1); complete()
  await Promise.all([first, second]); assert.equal(refreshes, 1)
})

test('a server-rejected expired session is removed, while a temporary network failure preserves it', async () => {
  const initial = { ...credentials(), site: 'domestic' }
  const rejected = boot(config => { throw unauthorized(config) }, new Map([['session', initial]]))
  await rejected.api.initializeMobileSession(false)
  await assert.rejects(rejected.api.mobileApi.get('/user/profile'))
  assert.equal(rejected.api.mobileUser.value, null); assert.equal(rejected.stored.get('session'), null)
  const offline = boot(config => {
    if (config.url === '/auth/native/refresh') throw new AxiosError('Network unavailable', 'ERR_NETWORK', config)
    throw unauthorized(config)
  }, new Map([['session', initial]]))
  await offline.api.initializeMobileSession(false)
  await assert.rejects(offline.api.mobileApi.get('/user/profile'))
  assert.equal(offline.api.mobileUser.value?.id, profile.id)
  assert.equal((offline.stored.get('session') as any).refreshToken, 'refresh-1')
})

test('logout revokes the rotated device credential and cold restart stays signed out', async () => {
  let revoked = false
  const { api, stored } = boot(config => {
    if (config.url === '/auth/native/refresh') return response(config, credentials('access-2', 'refresh-2'))
    assert.equal(config.url, '/auth/native/logout')
    assert.equal(JSON.parse(config.data).refreshToken, 'refresh-2')
    revoked = true; return response(config, null)
  }, new Map([['session', { ...credentials(), site: 'domestic' }]]))
  await api.initializeMobileSession(false); await api.logoutMobile()
  assert.equal(revoked, true); assert.equal(api.mobileUser.value, null); assert.equal(stored.get('session'), null)
  const cold = boot(() => { throw new Error('A signed-out restart must not call authentication') }, stored)
  await cold.api.initializeMobileSession(false); assert.equal(cold.api.mobileUser.value, null)
})

test('a late refresh cannot revive an explicitly forgotten account', async () => {
  let complete!: () => void
  const { api, stored } = boot(config => new Promise(resolve => { complete = () => resolve(response(config, credentials('access-2', 'refresh-2'))) }),
    new Map([['session', { ...credentials(), site: 'domestic' }]]))
  await api.initializeMobileSession(false)
  const refresh = api.refreshMobileSession(), rejected = assert.rejects(refresh, { name: 'MobileSessionChangedError' })
  await settle(); await api.forgetMobileSession(); complete(); await rejected
  assert.equal(api.mobileUser.value, null); assert.equal(stored.get('session'), null)
})
