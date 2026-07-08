import api from './api'
import type { TarotCard } from '../data/tarotCards'
import type { ReadingResult, ThreeCardReadingResult, DailyFortuneResult } from '../data/tarotReadings'
import { useReadingHistoryStore } from '../stores/readingHistory'

/**
 * 占卜成功后失效历史记录分页缓存，确保历史页能立即看到最新记录。
 * 在非组件环境调用 Pinia store 时做容错（理论上 setActivePinia 已在启动时调用）。
 */
function invalidateHistoryCache() {
  try {
    useReadingHistoryStore().clearPageCache()
  } catch {
    /* pinia 未就绪时忽略：下次进入历史页会按 TTL 自然刷新 */
  }
}

/**
 * 单卡占卜 - 调用后端 API
 * 后端负责：随机抽牌 + 调用 DeepSeek + 保存历史 + 扣减配额
 * 返回完整的卡牌信息和解读结果
 */
export async function generateAiSingleCardReading(
  card: TarotCard,
  isReversed: boolean,
  question: string
): Promise<ReadingResult> {
  const res = await api.post('/readings/single-card', {
    question,
    cardId: card.id,
    orientation: isReversed ? 'reversed' : 'upright',
  })
  if (res.data.success) {
    invalidateHistoryCache()
    return res.data.data.result
  }
  throw new Error(res.data.message || '占卜失败')
}

/**
 * 三卡占卜 - 调用后端 API
 */
export async function generateAiThreeCardReading(
  cards: { card: TarotCard; isReversed: boolean }[],
  question: string
): Promise<ThreeCardReadingResult> {
  const res = await api.post('/readings/three-card', {
    question,
    cardIds: cards.map(c => c.card.id),
    orientations: cards.map(c => c.isReversed ? 'reversed' : 'upright'),
  })
  if (res.data.success) {
    invalidateHistoryCache()
    return res.data.data.result
  }
  throw new Error(res.data.message || '占卜失败')
}

/**
 * 每日运势 - 调用后端 API
 */
export async function generateAiDailyFortune(
  card: TarotCard,
  isReversed: boolean,
  zodiacSign?: string
): Promise<DailyFortuneResult> {
  const res = await api.post('/readings/daily-fortune', {
    zodiacSign,
    cardId: card.id,
    isReversed,
  })
  if (res.data.success) {
    invalidateHistoryCache()
    return res.data.data.result
  }
  throw new Error(res.data.message || '运势生成失败')
}

// 星座运势类型
export type HoroscopePeriod = 'today' | 'tomorrow' | 'week'

export interface HoroscopeResult {
  sign: string
  date: string
  period?: HoroscopePeriod
  summary: string
  overallScore: number
  sections: { overall: string; love: string; career: string; wealth: string; health: string }
  ratings: { overall: number; love: number; career: number; wealth: number; health: number }
  energy?: { mood: number; action: number; social: number; intuition: number }
  advice?: { do: string; avoid: string; mantra: string; keyword: string }
  luckyColor: string
  luckyNumber: number
  origin: 'source' | 'ai'
}

/**
 * 星座今日运势 - 调用后端 API（按星座+日期服务端缓存，公开接口、不消耗配额）
 */
export async function getHoroscope(sign: string, period: HoroscopePeriod = 'today'): Promise<HoroscopeResult> {
  const res = await api.get(`/readings/horoscope?sign=${encodeURIComponent(sign)}&period=${encodeURIComponent(period)}`)
  if (res.data.success) {
    return res.data.data as HoroscopeResult
  }
  throw new Error(res.data.message || '星座运势获取失败')
}

// Reader-reading types
export interface ReaderReadingMessage {
  type: 'greeting' | 'reveal' | 'reading' | 'synthesis' | 'closing'
  content: string
}

export interface ReaderReadingCard {
  id: number
  name: string
  nameEn: string
  isReversed: boolean
  position: string
}

export interface ReaderReadingResult {
  id: number
  reader: { id: string; name: string; emoji: string }
  spread: { type: string; name: string; positions: string[] }
  cards: ReaderReadingCard[]
  result: {
    messages: ReaderReadingMessage[]
    summary: string
  }
}

export async function generateReaderReading(params: {
  readerId: string
  spreadType: string
  question: string
  category: string
  cardIds?: number[]
  orientations?: string[]
}): Promise<ReaderReadingResult> {
  const res = await api.post('/readings/reader-reading', params)
  if (res.data.success) {
    invalidateHistoryCache()
    return res.data.data
  }
  throw new Error(res.data.message || '占卜失败')
}

/** 一轮追问对话（前端维护，未持久化） */
export interface ReaderFollowupTurn {
  question: string
  answer: string
}

export interface ReaderFollowupResult {
  readingId: number
  question: string
  answer: string
}

/**
 * 塔罗师追问 - 基于已完成的某次占卜继续提问
 * 后端按 readingId 还原占卜上下文（问题/牌面/原解读），扣减一次配额
 * priorTurns 为本会话此前的追问轮次，作为多轮对话上下文
 */
export async function askReaderFollowUp(params: {
  readingId: number
  question: string
  priorTurns?: ReaderFollowupTurn[]
}): Promise<ReaderFollowupResult> {
  const res = await api.post('/readings/reader-followup', params)
  if (res.data.success) {
    return res.data.data
  }
  throw new Error(res.data.message || '追问失败')
}
