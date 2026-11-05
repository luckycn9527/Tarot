import assert from 'node:assert/strict'
import test from 'node:test'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, String(value)) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
}
Object.assign(globalThis, {
  localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage(), window: new EventTarget(),
})

const { createPinia, setActivePinia } = await import('pinia')
const { useAuthStore } = await import('../src/stores/auth')
const { useReadingHistoryStore } = await import('../src/stores/readingHistory')
const { useUserResourcesStore } = await import('../src/stores/userResources')
const { default: api, publicApi, setAccessToken } = await import('../src/services/api')
const { StorageKeys, storageSet, storageGetRaw } = await import('../src/utils/storage')
const { isCurrentDailyCache } = await import('../src/utils/dailyCache')
const { askReaderFollowUp } = await import('../src/services/tarotAiReading')
const { readerFollowupSchema } = await import('../../tarot-server/src/schemas/reading.schema')

function user(id: number) { return { id, nickname: `user-${id}` } as any }
function response(config: any, data: unknown) {
  return { config, data: { success: true, data }, status: 200, statusText: 'OK', headers: {} }
}

test('long saved conversations can continue and refresh their cached history', async () => {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.currentUser = user(90)
  const history = useReadingHistoryStore()
  let historyCalls = 0
  api.defaults.adapter = async config => {
    if (config.url?.startsWith('/readings/history')) {
      historyCalls++
      return response(config, { items: [{ id: 77 }], page: 1, totalPages: 1, total: 1 })
    }
    const body = JSON.parse(config.data)
    assert.ok(config.data.length < 300, 'a long saved conversation must not be transferred with every followup')
    assert.equal(readerFollowupSchema.safeParse(body).success, true, 'saved conversation must not cause request validation failure')
    assert.equal(body.locale, 'en-US')
    return response(config, { readingId: 77, question: body.question, answer: 'New answer' })
  }
  await history.fetchHistory()
  const result = await askReaderFollowUp({ readingId: 77, question: 'What should I do next?', locale: 'en-US',
    priorTurns: Array.from({ length: 12 }, (_, index) => ({ question: `Previous question ${index}`, answer: 'A'.repeat(5000) })) })
  assert.equal(result.answer, 'New answer')
  await history.fetchHistory()
  assert.equal(historyCalls, 2, 'saved followup must invalidate the previous history page')
})

test('switching accounts clears private state and refetches history inside the cache TTL', async () => {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  const history = useReadingHistoryStore()
  const resources = useUserResourcesStore()
  auth.currentUser = user(1)
  const calls: string[] = []
  api.defaults.adapter = async config => {
    calls.push(config.url!)
    return response(config, { items: [{ id: auth.currentUser!.id }], total: 1, page: 1, totalPages: 1 })
  }
  storageSet(StorageKeys.YES_NO_USER_Q, 'Account A private question')
  await history.fetchHistory()
  resources.quotaState.isVip = true
  auth.currentUser = user(2)
  assert.equal(storageGetRaw(StorageKeys.YES_NO_USER_Q), null)
  assert.deepEqual(history.history, [])
  assert.equal(resources.quotaState.isVip, false)
  assert.equal((await history.fetchHistory()).items[0].id, 2)
  assert.equal(calls.length, 2)
  auth.currentUser = null
  auth.currentUser = user(1)
  assert.equal(storageGetRaw(StorageKeys.YES_NO_USER_Q), null)
})

test('late responses from the previous account cannot refill history or quota', async () => {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  const history = useReadingHistoryStore()
  const resources = useUserResourcesStore()
  auth.currentUser = user(10)
  const pending: Array<() => void> = []
  api.defaults.adapter = config => new Promise(resolve => {
    pending.push(() => resolve(response(config, config.url?.includes('history')
      ? { items: [{ id: 10 }], page: 1, totalPages: 1, total: 1 }
      : { remaining: 99, isVip: true })))
  })
  const oldHistory = history.fetchHistory()
  const oldQuota = resources.fetchQuota(true)
  await new Promise(resolve => setImmediate(resolve))
  auth.currentUser = user(11)
  pending.forEach(resolve => resolve())
  await assert.rejects(oldHistory, { name: 'SessionChangedError' })
  await oldQuota
  assert.deepEqual(history.history, [])
  assert.equal(resources.quotaState.remaining, 3)
  assert.equal(resources.quotaState.isVip, false)
})

test('unowned legacy results are discarded instead of being assigned to the next login', () => {
  localStorage.setItem('etomd:v1:dailyFortune', 'private legacy data')
  localStorage.setItem('singleCardReadingResult', 'private legacy data')
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.currentUser = user(20)
  assert.equal(localStorage.getItem('etomd:v1:dailyFortune'), null)
  assert.equal(storageGetRaw(StorageKeys.YES_NO_SINGLE_RESULT, 'singleCardReadingResult'), null)
})

test('a refresh cookie changed by another tab cannot switch an in-flight request to that account', async () => {
  const { default: axios, AxiosError } = await import('axios')
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.currentUser = user(30)
  setAccessToken('inert-expired-access-token')
  const originalPost = axios.post
  let calls = 0
  const clear = () => auth.clearSession()
  window.addEventListener('auth:logout', clear)
  axios.post = (async () => ({ data: { data: { accessToken: 'foreign-account-token', user: { id: 31 } } } })) as typeof axios.post
  api.defaults.adapter = async config => {
    calls++
    throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, undefined, { ...response(config, null), status: 401 })
  }
  try {
    await assert.rejects(api.get('/readings/history'))
    assert.equal(calls, 1)
    assert.equal(auth.currentUser, null)
    assert.equal(localStorage.getItem('tarot_access_token'), null)
  } finally {
    axios.post = originalPost
    window.removeEventListener('auth:logout', clear)
  }
})

test('daily cache follows the server day and expires exactly at its reset boundary', () => {
  const value = { date: '2026-10-28', cardId: 0, isReversed: false }
  const deadline = '2026-10-28T16:00:00.000Z'
  assert.equal(isCurrentDailyCache(value, '2026-10-28', deadline, Date.parse('2026-10-27T16:30:00Z')), true)
  assert.equal(isCurrentDailyCache(value, '2026-10-29', deadline), false)
  assert.equal(isCurrentDailyCache(value, '2026-10-28', deadline, Date.parse(deadline)), false)
  assert.equal(isCurrentDailyCache(value, undefined, undefined), false)
  assert.equal(isCurrentDailyCache({ ...value, cardId: 999 }, value.date, deadline, 0), false)
})

test('guest quota and card-back initialization never calls protected endpoints', async () => {
  setActivePinia(createPinia())
  useAuthStore().clearSession()
  const resources = useUserResourcesStore()
  let calls = 0
  api.defaults.adapter = async config => { calls++; return response(config, {}) }
  await Promise.all([resources.fetchQuota(true), resources.fetchSettings(true)])
  assert.equal(calls, 0)
  assert.equal(resources.settings, null)
})

test('wrong login credentials are returned directly without refreshing the session', async () => {
  const { default: axios, AxiosError } = await import('axios')
  setActivePinia(createPinia())
  useAuthStore().clearSession()
  const originalPost = axios.post
  let refreshes = 0
  axios.post = (async () => { refreshes++; throw new Error('refresh should not be attempted') }) as typeof axios.post
  api.defaults.adapter = async config => {
    throw new AxiosError('Wrong password', 'ERR_BAD_REQUEST', config, undefined, { ...response(config, null), status: 401 })
  }
  try {
    await assert.rejects(api.post('/auth/login', { identifier: 'fixture@example.invalid', password: 'inert-test-input' }))
    assert.equal(refreshes, 0)
  } finally { axios.post = originalPost }
})

test('startup with an invalid expired session performs only one refresh attempt', async () => {
  const { default: axios, AxiosError } = await import('axios')
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.clearSession()
  setAccessToken('inert-expired-session')
  const originalPost = axios.post
  let refreshes = 0
  const requests: string[] = []
  axios.post = (async () => { refreshes++; throw new Error('expired refresh cookie') }) as typeof axios.post
  api.defaults.adapter = async config => {
    requests.push(config.url!)
    throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, undefined, { ...response(config, null), status: 401 })
  }
  try {
    await auth.initSession()
    assert.equal(refreshes, 1)
    assert.deepEqual(requests, ['/user/profile'])
    assert.equal(auth.isInitialized, true)
    assert.equal(auth.isLoggedIn, false)
  } finally { axios.post = originalPost }
})

test('parallel authenticated failures share one refresh and all requests use the replacement token', async () => {
  const { default: axios, AxiosError } = await import('axios')
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.currentUser = user(40)
  setAccessToken('inert-old-access-token')
  const originalPost = axios.post
  let refreshes = 0
  let release: () => void = () => {}
  const pending = new Promise<void>(resolve => { release = resolve })
  axios.post = (async () => {
    refreshes++
    await pending
    return { data: { data: { accessToken: 'inert-new-access-token', user: { id: 40 } } } }
  }) as typeof axios.post
  api.defaults.adapter = async config => {
    if (config.headers.get('Authorization') !== 'Bearer inert-new-access-token') {
      throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, undefined, { ...response(config, null), status: 401 })
    }
    return response(config, { restored: true })
  }
  try {
    const results = Promise.all(['/user/profile', '/user/quota', '/user/settings'].map(path => api.get(path)))
    await new Promise(resolve => setImmediate(resolve))
    release()
    assert.equal((await results).length, 3)
    assert.equal(refreshes, 1)
  } finally { axios.post = originalPost; setAccessToken(null) }
})

test('public bootstrap data may finish after session restoration without being discarded', async () => {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.clearSession()
  setAccessToken('inert-stored-session')
  let release: () => void = () => {}
  let sentAuthorization: unknown
  publicApi.defaults.adapter = config => new Promise(resolve => {
    sentAuthorization = config.headers.get('Authorization')
    release = () => resolve(response(config, { cards: [{ id: 0 }] }))
  })
  const bootstrap = publicApi.get('/reference/core')
  await new Promise(resolve => setImmediate(resolve))
  auth.currentUser = user(41)
  release()
  const restored = await bootstrap
  assert.equal(restored.data.data.cards.length, 1)
  assert.equal(sentAuthorization, undefined)
  setAccessToken(null)
})
