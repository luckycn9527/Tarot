import { storeToRefs } from 'pinia'
import { useReadingHistoryStore } from '@/stores/readingHistory'

export type { ReadingHistoryEntry, HistoryPage } from '@/stores/readingHistory'

export function useReadingHistory() {
  const s = useReadingHistoryStore()
  const { history } = storeToRefs(s)
  return {
    history,
    fetchHistory: s.fetchHistory,
    deleteReading: s.deleteReading,
    setOutcome: s.setOutcome,
    fetchInsights: s.fetchInsights,
    clearHistory: s.clearHistory,
  }
}
