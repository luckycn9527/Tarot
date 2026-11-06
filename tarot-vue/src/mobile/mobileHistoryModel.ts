export type MobileHistoryFilters = { type: string; from: string; to: string }
export type MobileOutcomeRating = 'full' | 'partial' | 'none'
export type MobileReadingOutcome = { rating: MobileOutcomeRating; at?: string }

/** Compare the calendar fields as well as the timestamp: Date accepts Feb 30. */
export function validHistoryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function historyFilterError(filters: MobileHistoryFilters, english = false): string {
  if (!filters || typeof filters.type !== 'string' || typeof filters.from !== 'string' || typeof filters.to !== 'string') return english ? 'Choose valid filters.' : '请选择有效的筛选条件。'
  if (!['', 'single', 'three-card', 'reader-reading'].includes(filters.type)) {
    return english ? 'Choose a supported reading type.' : '请选择有效的占卜类型。'
  }
  if ((filters.from && !validHistoryDate(filters.from)) || (filters.to && !validHistoryDate(filters.to))) {
    return english ? 'Enter valid dates in YYYY-MM-DD format.' : '请输入有效日期，格式为年-月-日。'
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return english ? 'The start date must be on or before the end date.' : '开始日期不能晚于结束日期。'
  }
  return ''
}

export function normalizeMobileOutcome(value: unknown): MobileReadingOutcome | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const outcome = value as Record<string, unknown>
  if (outcome.rating !== 'full' && outcome.rating !== 'partial' && outcome.rating !== 'none') return null
  return {
    rating: outcome.rating,
    ...(typeof outcome.at === 'string' && Number.isFinite(new Date(outcome.at).getTime()) ? { at: outcome.at } : {}),
  }
}
