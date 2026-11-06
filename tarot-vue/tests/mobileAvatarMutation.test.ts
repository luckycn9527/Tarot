import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import type { User } from '../src/stores/auth'

// Execute the real API module with in-memory device storage and local adapters.
// No authentication, upload or external HTTP request reaches a server.
const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/mobile/mobileApi.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue', 'axios'],
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'isolated-avatar-storage', setup(builder) {
    builder.onResolve({ filter: /^\.\/mobileStorage$/ }, () => ({ path: 'storage', namespace: 'avatar-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'avatar-test' }, () => ({ contents: 'export const mobileSite="domestic"; export const readMobileValue=key=>__store.read(key); export const writeMobileValue=(key,value)=>__store.write(key,value);' }))
  } }],
})
const require = createRequire(import.meta.url)
function user(id = 731, extras: Partial<User> = {}): User {
  return { id, nickname: 'Original seeker', username: null, email: 'avatar-fixture@example.invalid', avatar: '/uploads/avatars/old.webp', gender: '', birthday: null, birthTime: null, zodiacSign: null, location: null, bio: null, membership: 'free', membershipExpiresAt: null, remainingFreeQuota: 3, createdAt: '2020-01-01', ...extras }
}
function session(profile: User) { return { user: profile, accessToken: 'inert-avatar-access', refreshToken: 'inert-avatar-refresh', site: 'domestic' } }
function boot(profile = user()) {
  const stored = new Map<string, unknown>([['session', session(profile)]]), module = { exports: {} }
  const storage = {
    read: async (key: string) => structuredClone(stored.get(key) ?? null),
    write: async (key: string, value: unknown) => { if (value === null) stored.delete(key); else stored.set(key, structuredClone(value)) },
  }
  new Function('require', 'module', 'exports', '__store', 'window', compiled.outputFiles[0]!.text)(require, module, module.exports, storage, { location: { origin: 'https://local.fixture.invalid' } })
  const api = module.exports as typeof import('../src/mobile/mobileApi')
  api.mobileApi.defaults.adapter = async () => { throw new Error('Unexpected local fixture request') }
  return { api, stored }
}
function response(config: any, data: unknown) { return { config, data: { success: true, data }, status: 200, statusText: 'OK', headers: {} } }
const file = () => new File(['inert-raster-fixture'], 'avatar.webp', { type: 'image/webp' })
const settle = () => new Promise(resolve => setImmediate(resolve))

test('a late avatar response changes only the avatar after newer quota, membership and profile fields were accepted', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  const latest = user(731, { remainingFreeQuota: 0, membership: 'vip', membershipExpiresAt: '2030-01-01T00:00:00.000Z', nickname: 'Latest seeker', birthday: '1990-05-17', birthTime: '00:00', zodiacSign: 'Taurus' })
  let finishAvatar!: () => void
  api.mobileApi.defaults.adapter = async config => {
    if (config.url === '/user/avatar') {
      assert.ok(config.data instanceof FormData)
      assert.equal((config.data.get('avatar') as File).name, 'avatar.webp')
      assert.equal(config.timeout, 30_000)
      return new Promise(resolve => { finishAvatar = () => resolve(response(config, user(731, { avatar: '/uploads/avatars/new.webp' }))) })
    }
    if (config.url === '/user/profile') return response(config, latest)
    assert.equal(config.url, '/user/quota')
    return response(config, { remaining: 0, membership: latest.membership, membershipExpiresAt: latest.membershipExpiresAt })
  }
  const upload = api.uploadMobileAvatar(file()); await settle()
  await api.refreshMobileProfile()
  assert.equal(api.mobileUser.value?.remainingFreeQuota, 0)
  finishAvatar(); const accepted = await upload
  const expected = { ...latest, avatar: '/uploads/avatars/new.webp' }
  assert.deepEqual(accepted, expected)
  assert.deepEqual(api.mobileUser.value, expected)
  assert.deepEqual((stored.get('session') as any).user, expected)
})

test('a late avatar cannot erase credits added by a newer profile refresh', async () => {
  const initial = user(731, { remainingFreeQuota: 0 }), { api, stored } = boot(initial)
  await api.initializeMobileSession(false)
  let finishAvatar!: () => void
  api.mobileApi.defaults.adapter = async config => {
    if (config.url === '/user/avatar') return new Promise(resolve => { finishAvatar = () => resolve(response(config, { ...initial, avatar: '/uploads/avatars/new.webp' })) })
    if (config.url === '/user/profile') return response(config, user(731, { remainingFreeQuota: 5 }))
    assert.equal(config.url, '/user/quota'); return response(config, { remaining: 5 })
  }
  const upload = api.uploadMobileAvatar(file()); await settle(); await api.refreshMobileProfile()
  finishAvatar(); await upload
  assert.equal(api.mobileUser.value?.remainingFreeQuota, 5)
  assert.equal((stored.get('session') as any).user.remainingFreeQuota, 5)
})

test('unconfirmed or invalid avatar responses do not change the current or persisted profile', async () => {
  const invalidAvatars: unknown[] = [null, '', ' ', 17, 'javascript:alert(1)', 'data:image/png;base64,AA', 'file:///avatar.webp', '//cdn.example.invalid/avatar.webp', '/favicon.ico', '/uploads/avatars/a\\b.webp', '/uploads/avatars/a\nb.webp', ' https://cdn.example.invalid/avatar.webp', 'https://name:secret@cdn.example.invalid/avatar.webp']
  const bodies = [
    { success: false, data: user(731, { avatar: '/uploads/avatars/new.webp' }) },
    { data: user(731, { avatar: '/uploads/avatars/new.webp' }) },
    { success: true, data: null },
    { success: true, data: user(732, { avatar: '/uploads/avatars/new.webp' }) },
    ...invalidAvatars.map(avatar => ({ success: true, data: { ...user(), avatar } })),
  ]
  for (const body of bodies) {
    const initial = user(), { api, stored } = boot(initial); await api.initializeMobileSession(false)
    api.mobileApi.defaults.adapter = async config => ({ ...response(config, body.data), data: body })
    await assert.rejects(api.uploadMobileAvatar(file()), `Expected rejected avatar response: ${JSON.stringify(body)}`)
    assert.deepEqual(api.mobileUser.value, initial)
    assert.deepEqual((stored.get('session') as any).user, initial)
  }
})

test('root upload paths and credential-free HTTP(S) avatar URLs remain supported', async () => {
  for (const avatar of ['/uploads/avatars/new.webp', 'https://cdn.example.invalid/avatars/new.webp?revision=2', 'http://local.fixture.invalid/uploads/avatars/new.webp']) {
    const { api, stored } = boot(); await api.initializeMobileSession(false)
    api.mobileApi.defaults.adapter = async config => response(config, user(731, { avatar }))
    const saved = await api.uploadMobileAvatar(file())
    assert.equal(saved.avatar, avatar)
    assert.equal((stored.get('session') as any).user.avatar, avatar)
  }
})

test('a failed avatar request retains the old profile and can be explicitly retried', async () => {
  const initial = user(), { api, stored } = boot(initial); await api.initializeMobileSession(false)
  let calls = 0
  api.mobileApi.defaults.adapter = async config => {
    assert.equal(config.url, '/user/avatar')
    if (++calls === 1) throw new Error('Local simulated upload failure')
    return response(config, user(731, { avatar: '/uploads/avatars/retry.webp' }))
  }
  await assert.rejects(api.uploadMobileAvatar(file()))
  assert.deepEqual(api.mobileUser.value, initial); assert.deepEqual((stored.get('session') as any).user, initial)
  await api.uploadMobileAvatar(file())
  assert.equal(api.mobileUser.value?.avatar, '/uploads/avatars/retry.webp'); assert.equal(calls, 2)
})

test('a late avatar response cannot write into another account or revive a signed-out session', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  let finishAvatar!: () => void
  api.mobileApi.defaults.adapter = async config => new Promise(resolve => { finishAvatar = () => resolve(response(config, user(731, { avatar: '/uploads/avatars/owner731.webp' }))) })
  const upload = api.uploadMobileAvatar(file()), rejected = assert.rejects(upload, { name: 'MobileSessionChangedError' })
  await settle(); await api.forgetMobileSession()
  const next = user(732, { avatar: '/uploads/avatars/owner732.webp' })
  stored.set('session', session(next)); await api.initializeMobileSession(false)
  finishAvatar(); await rejected
  assert.deepEqual(api.mobileUser.value, next); assert.deepEqual((stored.get('session') as any).user, next)
})
