import type { ReaderReadingResult, ReaderFollowupResult } from '@/services/tarotAiReading'
import type { ReadingHistoryEntry } from '@/stores/readingHistory'

export interface MobileCard { id: number; isReversed: boolean }
export interface MobileReader { id: string; name: string; accessLevel: 'free' | 'vip'; desc?: string; avatarUrl?: string | null; avatarThumbUrl?: string | null }
export interface MobileReaderPreference {
  schema: 1; site: 'domestic' | 'overseas'; owner: number | null; readerId: string; savedAt: number
}
export interface MobileSpread { id: string; name: string; cardCount: number; accessLevel: 'free' | 'vip'; positions: string[] }
export interface MobileReadingPayload {
  readerId: string; spreadType: string; question: string; category: string
  cardIds: number[]; orientations: ('upright' | 'reversed')[]; locale: 'zh-CN' | 'en-US'
}
export interface MobileFollowupPayload { readingId: number; question: string; locale: 'zh-CN' | 'en-US' }
export interface MobileTask {
  requestId: string; kind: 'reading' | 'followup'; status: 'running' | 'succeeded' | 'failed'
  result?: ReaderReadingResult | ReaderFollowupResult; historyId?: number
  error?: { message: string; code?: string }; retryable?: boolean
}
export interface PendingMobileTask {
  schema: 1; owner: number; requestId: string; kind: 'reading' | 'followup'; createdAt: number
  payload: MobileReadingPayload | MobileFollowupPayload
}
export interface MobileDraft {
  schema: 1; owner: number | null; question: string; count: 1 | 3; readerId: string
  carried: MobileCard | null; deck: MobileCard[]; selected: number[]; revealed: number[]
  phase: 'question' | 'select' | 'reveal' | 'result'; readingId?: number; savedAt: number
}
export type MobileHistoryEntry = ReadingHistoryEntry
