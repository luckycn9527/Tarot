import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMobileHistoryPage } from '../src/mobile/mobileHistoryLoader'
import type { HistoryPage } from '../src/stores/readingHistory'

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const cached: HistoryPage = { items: [{ id: 71 } as HistoryPage['items'][number]], total: 1, page: 1, totalPages: 1 }
const fresh: HistoryPage = { items: [{ id: 81 } as HistoryPage['items'][number]], total: 1, page: 1, totalPages: 1 }
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture(patch: Partial<Parameters<typeof loadMobileHistoryPage>[0]> = {}) {
  const shown: { page: HistoryPage; cached: boolean }[] = [], failures: unknown[] = [], saved: HistoryPage[] = []
  const counts = { reads: 0, fetches: 0, offline: 0 }
  const options: Parameters<typeof loadMobileHistoryPage>[0] = {
    cacheEligible: true, connected: true, isCurrent: () => true,
    readCache: async () => { counts.reads++; return cached },
    fetchPage: async () => { counts.fetches++; return fresh },
    show: (page, cached) => { shown.push({ page, cached }) },
    saveCache: async page => { saved.push(page) }, fail: error => { failures.push(error) },
    offline: () => { counts.offline++ }, ...patch,
  }
  return { options, shown, failures, saved, counts }
}

test('the cached list is readable before a slow network completes, then fresh data replaces it', async () => {
  const network = deferred<HistoryPage>()
  const f = fixture({ fetchPage: () => network.promise })
  const loading = loadMobileHistoryPage(f.options)
  await tick()
  assert.deepEqual(f.shown, [{ page: cached, cached: true }])
  assert.deepEqual(f.saved, [])
  network.resolve(fresh); await loading
  assert.deepEqual(f.shown, [{ page: cached, cached: true }, { page: fresh, cached: false }])
  assert.deepEqual(f.saved, [fresh])
})

test('an explicitly offline first page shows its cache without sending an API request', async () => {
  const f = fixture({ connected: false })
  await loadMobileHistoryPage(f.options)
  assert.deepEqual(f.shown, [{ page: cached, cached: true }])
  assert.equal(f.counts.fetches, 0); assert.equal(f.counts.offline, 1)
})

test('filtered searches and later pages cannot reuse or overwrite the unfiltered first-page cache', async () => {
  const f = fixture({ cacheEligible: false })
  await loadMobileHistoryPage(f.options)
  assert.equal(f.counts.reads, 0); assert.equal(f.counts.fetches, 1)
  assert.deepEqual(f.shown, [{ page: fresh, cached: false }]); assert.deepEqual(f.saved, [])
  const offline = fixture({ cacheEligible: false, connected: false })
  await loadMobileHistoryPage(offline.options)
  assert.equal(offline.counts.reads, 0); assert.equal(offline.counts.fetches, 0); assert.deepEqual(offline.shown, [])
})

test('an account or request change while reading cache prevents stale display and network work', async () => {
  const storage = deferred<unknown>(); let current = true
  const f = fixture({ readCache: () => storage.promise, isCurrent: () => current })
  const loading = loadMobileHistoryPage(f.options)
  current = false; storage.resolve(cached); await loading
  assert.deepEqual(f.shown, []); assert.equal(f.counts.fetches, 0); assert.deepEqual(f.saved, [])
})

test('a late network response cannot overwrite another account or a newer history request', async () => {
  const network = deferred<HistoryPage>(); let current = true
  const f = fixture({ fetchPage: () => network.promise, isCurrent: () => current })
  const loading = loadMobileHistoryPage(f.options); await tick()
  current = false; network.resolve(fresh); await loading
  assert.deepEqual(f.shown, [{ page: cached, cached: true }]); assert.deepEqual(f.saved, [])
})

test('an obsolete network error cannot replace a newer screen error', async () => {
  const network = deferred<HistoryPage>(); let current = true
  const f = fixture({ fetchPage: () => network.promise, isCurrent: () => current })
  const loading = loadMobileHistoryPage(f.options); await tick()
  current = false; network.reject(new Error('old request')); await loading
  assert.deepEqual(f.failures, [])
})

test('unreadable local storage does not block the real history request', async () => {
  const f = fixture({ readCache: async () => { throw new Error('storage unavailable') } })
  await loadMobileHistoryPage(f.options)
  assert.equal(f.counts.fetches, 1); assert.deepEqual(f.shown, [{ page: fresh, cached: false }]); assert.deepEqual(f.failures, [])
})

test('saving a successful cloud response may fail without misreporting the load as failed', async () => {
  const f = fixture({ saveCache: async () => { throw new Error('full storage') } })
  await loadMobileHistoryPage(f.options)
  assert.deepEqual(f.shown.at(-1), { page: fresh, cached: false }); assert.deepEqual(f.failures, [])
})

test('a network failure keeps the already-visible cache and reports the refresh error', async () => {
  const error = new Error('network unavailable')
  const f = fixture({ fetchPage: async () => { throw error } })
  await loadMobileHistoryPage(f.options)
  assert.deepEqual(f.shown, [{ page: cached, cached: true }]); assert.deepEqual(f.failures, [error]); assert.deepEqual(f.saved, [])
})

test('malformed cache metadata or a non-first-page cache is ignored', async () => {
  for (const value of [null, [], { ...cached, items: {} }, { ...cached, page: 2 }, { ...cached, total: -1 }, { ...cached, total: Infinity }, { ...cached, totalPages: 1.5 }]) {
    const f = fixture({ readCache: async () => value })
    await loadMobileHistoryPage(f.options)
    assert.deepEqual(f.shown, [{ page: fresh, cached: false }])
  }
})
