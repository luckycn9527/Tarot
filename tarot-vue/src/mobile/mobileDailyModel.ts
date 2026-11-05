import type { DailyFortuneResult } from '../data/tarotReadings'
import type { DailyFortuneResponse } from '../services/tarotAiReading'
import type { MobileCard } from './types'

export interface MobileDailyWindow { businessDate: string; resetsAt: string; timeZone: string }
export interface MobileDailyCache {
  schema: 1
  owner: number
  site: 'domestic' | 'overseas'
  window: MobileDailyWindow
  card: DailyFortuneResponse['card']
  result: DailyFortuneResult | null
  pending: MobileCard | null
}
export interface MobileDailyScope { owner: number; sequence: number }

const sectionKeys = ['intro', 'overall', 'love', 'career', 'wealth', 'health', 'mystery'] as const
const ratingKeys = ['overall', 'love', 'career', 'wealth', 'health'] as const
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function validMobileDailyCard(value: unknown): value is MobileCard {
  return object(value) && Number.isInteger(value.id) && Number(value.id) >= 0 && Number(value.id) < 78 && typeof value.isReversed === 'boolean'
}
export function validMobileDailyWindow(value: unknown, now = Date.now()): value is MobileDailyWindow {
  if (!object(value) || typeof value.businessDate !== 'string' || !calendarDate(value.businessDate)) return false
  // Require an explicit offset: a timezone-less timestamp must never become phone-local midnight.
  return typeof value.resetsAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.resetsAt)
    && calendarDate(value.resetsAt.slice(0, 10))
    && Date.parse(value.resetsAt) > now && text(value.timeZone)
}
export function sameMobileDailyWindow(left: MobileDailyWindow, right: MobileDailyWindow) {
  return left.businessDate === right.businessDate && left.resetsAt === right.resetsAt && left.timeZone === right.timeZone
}
export function validMobileDailyResult(value: unknown): value is DailyFortuneResult {
  if (!object(value) || !text(value.cardName) || !text(value.cardNameEn) || typeof value.isReversed !== 'boolean') return false
  const sections = value.sections, ratings = value.ratings
  return object(sections) && sectionKeys.every(key => text(sections[key])) && object(ratings)
    && ratingKeys.every(key => Number.isInteger(ratings[key]) && Number(ratings[key]) >= 1 && Number(ratings[key]) <= 5)
}
function validResultPair(card: unknown, result: unknown) {
  if (card === null || result === null) return card === null && result === null
  return validMobileDailyCard(card) && object(card) && text(card.name) && text(card.nameEn) && validMobileDailyResult(result)
    && card.isReversed === result.isReversed && card.name === result.cardName && card.nameEn === result.cardNameEn
}
export { validResultPair as validMobileDailyResultPair }
export function validMobileDailyResponse(value: unknown, now = Date.now()): value is DailyFortuneResponse {
  return object(value) && validMobileDailyWindow(value, now) && typeof value.cached === 'boolean' && validResultPair(value.card, value.result)
}
export function isCurrentMobileDailyCache(value: unknown, owner: number | null, site: string, now = Date.now(), expectedWindow?: MobileDailyWindow): value is MobileDailyCache {
  if (!object(value) || !Number.isSafeInteger(owner) || Number(owner) <= 0 || (site !== 'domestic' && site !== 'overseas') || value.schema !== 1 || value.owner !== owner || value.site !== site) return false
  if (!validMobileDailyWindow(value.window, now) || (expectedWindow && !sameMobileDailyWindow(value.window, expectedWindow))) return false
  return validResultPair(value.card, value.result) && (value.pending === null || (value.result === null && validMobileDailyCard(value.pending)))
}
export function mobileDailyCacheFromResponse(response: DailyFortuneResponse, owner: number, site: MobileDailyCache['site'], previous: MobileDailyCache | null = null): MobileDailyCache {
  const window = { businessDate: response.businessDate, resetsAt: response.resetsAt, timeZone: response.timeZone }
  return { schema: 1, owner, site, window, card: response.card, result: response.result,
    pending: !response.result && previous && previous.owner === owner && previous.site === site && sameMobileDailyWindow(previous.window, window) ? previous.pending : null }
}
export function mobileDailyResponseFromCache(cache: MobileDailyCache): DailyFortuneResponse {
  return { ...cache.window, card: cache.card, result: cache.result, cached: !!cache.result }
}
function random() { return crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296 }
export function selectMobileDailyCard(cache: MobileDailyCache, ids: readonly number[], sample: () => number = random): MobileCard {
  if (cache.pending) return { ...cache.pending }
  const available = [...new Set(ids.filter(id => Number.isInteger(id) && id >= 0 && id < 78))]
  if (!available.length) throw new Error('No daily cards available')
  const choice = Math.min(available.length - 1, Math.max(0, Math.floor(sample() * available.length)))
  return { id: available[choice]!, isReversed: sample() < .5 }
}
export function acceptsMobileDailyScope(scope: MobileDailyScope, owner: number | null, sequence: number, ready: boolean) {
  return ready && scope.owner === owner && scope.sequence === sequence
}
