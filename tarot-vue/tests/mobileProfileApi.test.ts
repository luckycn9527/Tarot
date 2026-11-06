import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import type { User } from '../src/stores/auth'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/mobile/mobileApi.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue', 'axios'],
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'isolated-profile-storage', setup(builder) {
    builder.onResolve({ filter: /^\.\/mobileStorage$/ }, () => ({ path: 'storage', namespace: 'profile-test' }))
    builder.onLoad({ filter: /.*/, namespace: 'profile-test' }, () => ({ contents: 'export const mobileSite="domestic"; export const readMobileValue=key=>__store.read(key); export const writeMobileValue=(key,value)=>__store.write(key,value);' }))
  } }],
})
const require = createRequire(import.meta.url)
function user(id = 1, extras: Partial<User> = {}): User {
  return { id, nickname: `User ${id}`, username: null, email: 'fixture@example.invalid', avatar: '/uploads/avatars/old.webp', gender: '', birthday: null, birthTime: null, zodiacSign: null, location: null, bio: null, membership: 'free', membershipExpiresAt: null, remainingFreeQuota: 18, createdAt: '2020-01-01', ...extras }
}
function session(profile: User) { return { user: profile, accessToken: 'inert-profile-fixture', refreshToken: 'inert-refresh-fixture', site: 'domestic' } }
function boot(profile = user()) {
  const stored = new Map<string, unknown>([['session', session(profile)]])
  const module = { exports: {} }
  const boundary = { read: async (key: string) => structuredClone(stored.get(key) ?? null), write: async (key: string, value: unknown) => { stored.set(key, structuredClone(value)) } }
  new Function('require', 'module', 'exports', '__store', 'window', compiled.outputFiles[0]!.text)(require, module, module.exports, boundary, { location: { origin: 'https://local.fixture.invalid' } })
  return { api: module.exports as typeof import('../src/mobile/mobileApi'), stored }
}
function response(config: any, data: unknown) { return { config, data: { success: true, data }, status: 200, statusText: 'OK', headers: {} } }
const settle = () => new Promise(resolve => setImmediate(resolve))

test('avatar multipart updates and persists the same account without an old background refresh replacing it', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  let resolveProfile!: () => void
  api.mobileApi.defaults.adapter = config => {
    if (config.url === '/user/profile') return new Promise(resolve => { resolveProfile = () => resolve(response(config, user())) })
    if (config.url === '/user/quota') return Promise.resolve(response(config, { remaining: 18 }))
    assert.equal(config.url, '/user/avatar')
    assert.ok(config.data instanceof FormData)
    assert.equal((config.data.get('avatar') as File).name, 'avatar.webp')
    return Promise.resolve(response(config, user(1, { avatar: '/uploads/avatars/new.webp' })))
  }
  const refresh = api.refreshMobileProfile(); await settle()
  await api.uploadMobileAvatar(new File(['raster-fixture'], 'avatar.webp', { type: 'image/webp' }))
  resolveProfile(); await refresh
  assert.equal(api.mobileUser.value?.avatar, '/uploads/avatars/new.webp')
  assert.equal((stored.get('session') as any).user.avatar, '/uploads/avatars/new.webp')
})

test('birth details save exact midnight and nullable unknown time while preserving the rest of the current profile', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  const bodies: unknown[] = []
  api.mobileApi.defaults.adapter = async config => {
    assert.equal(config.url, '/user/birth-info')
    if (config.method === 'get') return response(config, { birthday: '1990-05-17', birthTime: '00:00', zodiacSign: 'Taurus' })
    const value = JSON.parse(config.data); bodies.push(value)
    return response(config, { ...value, zodiacSign: value.birthday ? 'Taurus' : null })
  }
  assert.equal((await api.fetchMobileBirthInfo()).birthTime, '00:00')
  await api.saveMobileBirthInfo({ birthday: '1990-05-17', birthTime: '00:00' })
  assert.equal(api.mobileUser.value?.birthTime, '00:00')
  assert.equal(api.mobileUser.value?.remainingFreeQuota, 18)
  assert.equal(api.mobileUser.value?.avatar, '/uploads/avatars/old.webp')
  await api.saveMobileBirthInfo({ birthday: '1990-05-17', birthTime: null })
  assert.equal((stored.get('session') as any).user.birthTime, null)
  await api.saveMobileBirthInfo({ birthday: null, birthTime: null })
  assert.equal(api.mobileUser.value?.birthday, null)
  assert.deepEqual(bodies, [{ birthday: '1990-05-17', birthTime: '00:00' }, { birthday: '1990-05-17', birthTime: null }, { birthday: null, birthTime: null }])
})

test('a late avatar response cannot replace the next account or revive a signed-out session', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  let complete!: () => void
  api.mobileApi.defaults.adapter = config => new Promise(resolve => { complete = () => resolve(response(config, user(1, { avatar: '/uploads/avatars/old-account.webp' }))) })
  const upload = api.uploadMobileAvatar(new File(['raster-fixture'], 'avatar.webp', { type: 'image/webp' }))
  const rejected = assert.rejects(upload, { name: 'MobileSessionChangedError' })
  await settle(); await api.forgetMobileSession()
  stored.set('session', session(user(2, { avatar: '/uploads/avatars/account-2.webp' })))
  await api.initializeMobileSession(false); complete(); await rejected
  assert.equal(api.mobileUser.value?.id, 2)
  assert.equal(api.mobileUser.value?.avatar, '/uploads/avatars/account-2.webp')
  assert.equal((stored.get('session') as any).user.id, 2)
})

test('a failed save leaves the prior birth details and persisted profile intact', async () => {
  const initial = user(1, { birthday: '1990-05-17', birthTime: '08:30' })
  const { api, stored } = boot(initial); await api.initializeMobileSession(false)
  api.mobileApi.defaults.adapter = async () => { throw new Error('Local simulated connection failure') }
  await assert.rejects(api.saveMobileBirthInfo({ birthday: '1991-06-18', birthTime: '13:00' }))
  assert.equal(api.mobileUser.value?.birthday, initial.birthday)
  assert.equal((stored.get('session') as any).user.birthTime, '08:30')
})

test('nickname saves a trimmed value and restores the same name from local storage', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  const calls: string[] = []
  api.mobileApi.defaults.adapter = async config => {
    calls.push(config.url!)
    assert.equal(config.method, 'put'); assert.equal(config.url, '/user/profile')
    assert.deepEqual(JSON.parse(config.data), { nickname: '星语旅人' })
    return response(config, user(1, { nickname: '星语旅人' }))
  }
  const saved = await api.saveMobileNickname('  星语旅人  ')
  assert.equal(saved.nickname, '星语旅人')
  assert.equal(api.mobileUser.value?.nickname, '星语旅人')
  assert.equal((stored.get('session') as any).user.nickname, '星语旅人')
  const restarted = boot((stored.get('session') as any).user)
  await restarted.api.initializeMobileSession(false)
  assert.equal(restarted.api.mobileUser.value?.nickname, '星语旅人')
  assert.deepEqual(calls, ['/user/profile'])
})

test('a profile request started before a nickname save cannot replace the new name', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  let completeProfile!: () => void
  api.mobileApi.defaults.adapter = config => {
    if (config.url === '/user/profile' && config.method === 'get') return new Promise(resolve => { completeProfile = () => resolve(response(config, user())) })
    if (config.url === '/user/quota') return Promise.resolve(response(config, { remaining: 18 }))
    assert.equal(config.url, '/user/profile'); assert.equal(config.method, 'put')
    return Promise.resolve(response(config, user(1, { nickname: 'Updated seeker' })))
  }
  const refresh = api.refreshMobileProfile(); await settle()
  await api.saveMobileNickname('Updated seeker')
  completeProfile(); await refresh
  assert.equal(api.mobileUser.value?.nickname, 'Updated seeker')
  assert.equal((stored.get('session') as any).user.nickname, 'Updated seeker')
})

test('a late nickname response cannot write to the next account', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  let complete!: () => void
  api.mobileApi.defaults.adapter = config => new Promise(resolve => { complete = () => resolve(response(config, user(1, { nickname: 'Old account name' }))) })
  const save = api.saveMobileNickname('Old account name')
  const rejected = assert.rejects(save, { name: 'MobileSessionChangedError' })
  await settle(); await api.forgetMobileSession()
  stored.set('session', session(user(2, { nickname: 'Second account' })))
  await api.initializeMobileSession(false); complete(); await rejected
  assert.equal(api.mobileUser.value?.id, 2)
  assert.equal(api.mobileUser.value?.nickname, 'Second account')
  assert.equal((stored.get('session') as any).user.nickname, 'Second account')
})

test('nickname edits preserve unrelated fields accepted while their save is in flight', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  let complete!: () => void
  api.mobileApi.defaults.adapter = async config => {
    if (config.url === '/user/profile') return new Promise(resolve => { complete = () => resolve(response(config, user(1, { nickname: 'New name' }))) })
    assert.equal(config.url, '/user/birth-info')
    return response(config, { birthday: '1990-05-17', birthTime: '00:00', zodiacSign: 'Taurus' })
  }
  const name = api.saveMobileNickname('New name'); await settle()
  await api.saveMobileBirthInfo({ birthday: '1990-05-17', birthTime: '00:00' })
  complete(); await name
  assert.equal(api.mobileUser.value?.nickname, 'New name')
  assert.equal(api.mobileUser.value?.birthday, '1990-05-17')
  assert.equal((stored.get('session') as any).user.birthTime, '00:00')
})

test('failed nickname requests keep the previous name and support a later retry', async () => {
  const { api, stored } = boot(); await api.initializeMobileSession(false)
  let calls = 0
  api.mobileApi.defaults.adapter = async config => {
    if (++calls === 1) throw new Error('Local simulated connection failure')
    return response(config, user(1, { nickname: 'Retried name' }))
  }
  await assert.rejects(api.saveMobileNickname('Retried name'))
  assert.equal(api.mobileUser.value?.nickname, 'User 1')
  assert.equal((stored.get('session') as any).user.nickname, 'User 1')
  await api.saveMobileNickname('Retried name')
  assert.equal(api.mobileUser.value?.nickname, 'Retried name'); assert.equal(calls, 2)
})

test('invalid or unconfirmed nickname responses never update the local profile', async () => {
  for (const body of [{ success: false, data: user(1, { nickname: 'Unconfirmed' }) }, { success: true, data: user(2, { nickname: 'Other account' }) }, { success: true, data: user(1, { nickname: '' }) }, { success: true, data: user() }]) {
    const { api, stored } = boot(); await api.initializeMobileSession(false)
    api.mobileApi.defaults.adapter = async config => ({ ...response(config, body.data), data: body })
    await assert.rejects(api.saveMobileNickname('Changed name'))
    assert.equal(api.mobileUser.value?.nickname, 'User 1')
    assert.equal((stored.get('session') as any).user.nickname, 'User 1')
  }
})

test('invalid nickname input is rejected before any API request', async () => {
  const { api } = boot(); await api.initializeMobileSession(false)
  let calls = 0; api.mobileApi.defaults.adapter = async () => { calls++; throw new Error('Unexpected request') }
  for (const value of ['', '  ', 'a', '字'.repeat(21)]) await assert.rejects(api.saveMobileNickname(value))
  assert.equal(calls, 0)
})
