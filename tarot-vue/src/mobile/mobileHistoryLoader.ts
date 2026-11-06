import type { HistoryPage } from '../stores/readingHistory'

interface MobileHistoryLoadOptions {
  cacheEligible: boolean
  connected: boolean
  isCurrent: () => boolean
  readCache: () => Promise<unknown>
  fetchPage: () => Promise<HistoryPage>
  show: (page: HistoryPage, cached: boolean) => void
  saveCache: (page: HistoryPage) => Promise<void>
  fail: (error: unknown) => void
  offline: () => void
}

function validFirstPage(value: unknown): value is HistoryPage {
  if (!value || typeof value !== 'object') return false
  const page = value as HistoryPage
  return Array.isArray(page.items) && page.page === 1 && Number.isSafeInteger(page.total) && page.total >= 0 &&
    Number.isSafeInteger(page.totalPages) && page.totalPages >= 0
}

/** Present this account's unfiltered first page before waiting on the network. */
export async function loadMobileHistoryPage(options: MobileHistoryLoadOptions): Promise<void> {
  if (!options.isCurrent()) return
  if (options.cacheEligible) {
    let cache: unknown
    try { cache = await options.readCache() } catch { /* A storage error must not prevent cloud access. */ }
    if (!options.isCurrent()) return
    if (validFirstPage(cache)) options.show(cache, true)
  }
  if (!options.isCurrent()) return
  if (!options.connected) { options.offline(); return }
  try {
    const page = await options.fetchPage()
    if (!options.isCurrent()) return
    options.show(page, false)
    if (options.cacheEligible && options.isCurrent()) {
      try { await options.saveCache(page) } catch { /* The cloud result remains valid if local saving fails. */ }
    }
  } catch (error) {
    if (options.isCurrent()) options.fail(error)
  }
}
