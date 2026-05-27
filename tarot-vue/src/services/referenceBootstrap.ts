import { ref, type Ref } from 'vue'
import api from './api'
import type { TarotCard } from '../data/tarotCards'
import { applyTarotCardsFromApi } from '../data/tarotCards'
import type { TarotCardDetail } from '../data/tarotCardDetails'
import { applyTarotCardDetailsFromApi } from '../data/tarotCardDetails'
import type { ReaderInfo } from '../data/readers'
import { applyReadersFromApi } from '../data/readers'
import type { Spread, ReaderSpread } from '../data/spreadsData'
import { applySpreadsFromApi } from '../data/spreadsData'

export interface CardBackInfo {
  code: string
  name: string
  description: string | null
  assetUrl: string | null
  accessType: 'free' | 'vip' | 'paid'
  price: number | null
}

export interface ReferenceBundle {
  cdnBase: string
  cards: TarotCard[]
  cardDetails: Record<number, TarotCardDetail>
  readers: ReaderInfo[]
  spreads: Spread[]
  readerSpreads: ReaderSpread[]
  cardBacks: CardBackInfo[]
}

/** 响应式：设置变更 / 重新拉 bundle 后牌背图 URL 能驱动 useCardBack */
export const cardBacksList: Ref<CardBackInfo[]> = ref([])

export async function loadReferenceBundle(): Promise<void> {
  const res = await api.get('/reference/bundle')
  if (!res.data?.success) {
    throw new Error(res.data?.message || 'reference bundle failed')
  }
  const b = res.data.data as ReferenceBundle
  applyTarotCardsFromApi(b.cards, b.cdnBase)
  applyTarotCardDetailsFromApi(b.cardDetails ?? {})
  applyReadersFromApi(b.readers ?? [])
  applySpreadsFromApi(b.spreads ?? [], b.readerSpreads ?? [])
  cardBacksList.value = b.cardBacks ?? []
}
