import api from './api'
import type { TarotCard } from '../data/tarotCards'
import type { ReadingResult, ThreeCardReadingResult, DailyFortuneResult } from '../data/tarotReadings'

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
    return res.data.data.result
  }
  throw new Error(res.data.message || '运势生成失败')
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
    return res.data.data
  }
  throw new Error(res.data.message || '占卜失败')
}
