export interface DailyCache {
  date: string
  cardId: number
  isReversed: boolean
  fortune?: string
}

export function isCurrentDailyCache(value: unknown, businessDate: string | undefined,
  resetsAt: string | undefined, now = Date.now()): value is DailyCache {
  if (!value || typeof value !== 'object' || !businessDate || !resetsAt) return false
  const row = value as Partial<DailyCache>
  return row.date === businessDate && Date.parse(resetsAt) > now
    && Number.isInteger(row.cardId) && row.cardId! >= 0 && row.cardId! <= 77
    && typeof row.isReversed === 'boolean'
    && (row.fortune === undefined || typeof row.fortune === 'string')
}
