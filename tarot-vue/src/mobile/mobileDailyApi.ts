import type { DailyFortuneResponse } from '../services/tarotAiReading'
import type { MobileCard } from './types'
import { mobileApi } from './mobileApi'
import { validMobileDailyResponse } from './mobileDailyModel'
import { validMobileDailySnapshot, type MobileDailySnapshot } from './mobileYesterdayModel'

function dailyResponse(data: unknown): DailyFortuneResponse {
  if (!validMobileDailyResponse(data)) throw new Error('Invalid daily fortune response')
  return data
}
export async function fetchMobileDailyFortune(): Promise<DailyFortuneResponse> {
  const response = await mobileApi.get('/readings/daily-fortune')
  return dailyResponse(response.data.data)
}
export async function fetchMobileYesterdayFortune(expectedDate: string, timeZone: string): Promise<MobileDailySnapshot> {
  const response = await mobileApi.get('/readings/daily-fortune/yesterday')
  const data: unknown = response.data.data
  if (!validMobileDailySnapshot(data, expectedDate, timeZone)) throw new Error('Invalid yesterday fortune response')
  return data
}
export async function generateMobileDailyFortune(card: MobileCard): Promise<DailyFortuneResponse> {
  const response = await mobileApi.post('/readings/daily-fortune', { cardId: card.id, isReversed: card.isReversed }, { timeout: 45_000 })
  const daily = dailyResponse(response.data.data)
  if (!daily.result || !daily.card) throw new Error('Incomplete daily fortune response')
  return daily
}
