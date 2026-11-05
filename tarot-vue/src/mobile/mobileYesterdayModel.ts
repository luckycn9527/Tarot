import type { DailyFortuneResponse } from '../services/tarotAiReading'
import { validMobileDailyResultPair } from './mobileDailyModel'

export type MobileDailySnapshot = Pick<DailyFortuneResponse, 'businessDate' | 'timeZone' | 'cached' | 'card' | 'result'>
export interface MobileYesterdayCache { schema: 1; owner: number; site: string; snapshot: MobileDailySnapshot }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

// Subtract a calendar date, never 24 hours from a device-local/DST timestamp.
export function previousMobileBusinessDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  date.setUTCDate(date.getUTCDate() - 1)
  const previous = date.toISOString().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(previous) ? previous : null
}

export function validMobileDailySnapshot(value: unknown, expectedDate: string, timeZone: string): value is MobileDailySnapshot {
  return object(value) && previousMobileBusinessDate(expectedDate) !== null && !!timeZone.trim()
    && value.businessDate === expectedDate && value.timeZone === timeZone
    && typeof value.cached === 'boolean' && value.cached === (value.result !== null)
    && validMobileDailyResultPair(value.card, value.result)
}

export function validMobileYesterdayCache(value: unknown, owner: number | null, site: string, expectedDate: string, timeZone: string): value is MobileYesterdayCache {
  return object(value) && Number.isSafeInteger(owner) && Number(owner) > 0
    && (site === 'domestic' || site === 'overseas') && value.schema === 1 && value.owner === owner && value.site === site
    && validMobileDailySnapshot(value.snapshot, expectedDate, timeZone) && value.snapshot.result !== null
}
