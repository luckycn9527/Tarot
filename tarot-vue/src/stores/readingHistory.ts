import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import { CACHE_TTL_MS, isFresh } from '@/stores/cacheTtl'

export interface ReadingHistoryEntry {
  id: number
  type: 'single' | 'three-card' | 'daily-fortune' | 'reader-reading'
  question: string
  cardIds: number[]
  orientations: string[]
  answer: string
  resultData: unknown
  readerId: string | null
  spreadType: string | null
  createdAt: string
  updatedAt?: string
}

export interface HistoryPage {
  items: ReadingHistoryEntry[]
  total: number
  page: number
  totalPages: number
}

function buildHistoryParams(options?: {
  page?: number
  limit?: number
  type?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}) {
  const params = new URLSearchParams()
  if (options?.page) params.set('page', String(options.page))
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.type) params.set('type', options.type)
  if (options?.search) params.set('search', options.search)
  if (options?.dateFrom) params.set('dateFrom', options.dateFrom)
  if (options?.dateTo) params.set('dateTo', options.dateTo)
  return params
}

function historyCacheKey(options?: Parameters<typeof buildHistoryParams>[0]) {
  return buildHistoryParams(options).toString() || '_'
}

export const useReadingHistoryStore = defineStore('readingHistory', () => {
  const history = ref<ReadingHistoryEntry[]>([])
  const pageCache = ref<Record<string, { at: number; data: HistoryPage }>>({})

  function clearPageCache() {
    pageCache.value = {}
  }

  async function fetchHistory(options?: {
    page?: number
    limit?: number
    type?: string
    search?: string
    dateFrom?: string
    dateTo?: string
  }, force = false): Promise<HistoryPage> {
    const key = historyCacheKey(options)
    const hit = pageCache.value[key]
    if (!force && hit && isFresh(hit.at, CACHE_TTL_MS.readingHistory)) {
      history.value = hit.data.items
      return hit.data
    }
    try {
      const params = buildHistoryParams(options)
      const res = await api.get(`/readings/history?${params.toString()}`)
      if (res.data.success) {
        const data = res.data.data as HistoryPage
        history.value = data.items
        pageCache.value[key] = { at: Date.now(), data }
        return data
      }
    } catch {
      /* ignore */
    }
    return { items: [], total: 0, page: 1, totalPages: 0 }
  }

  async function deleteReading(id: number) {
    await api.delete(`/readings/history/${id}`)
    history.value = history.value.filter(h => h.id !== id)
    clearPageCache()
  }

  async function clearHistory() {
    for (const entry of history.value) {
      await api.delete(`/readings/history/${entry.id}`)
    }
    history.value = []
    clearPageCache()
  }

  return { history, fetchHistory, deleteReading, clearHistory, clearPageCache }
})
