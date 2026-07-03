import { ref, type Ref } from 'vue'
import api from './api'
import type { TarotCard } from '../data/tarotCards'
import { applyTarotCardsFromApi } from '../data/tarotCards'
import type { TarotCardDetail } from '../data/tarotCardDetails'
import { applyTarotCardDetailsFromApi } from '../data/tarotCardDetails'
import type { ReaderInfo } from '../data/readers'
import { applyFeaturedReadersFromApi, applyReadersFromApi } from '../data/readers'
import type { ReaderSpread, Spread } from '../data/spreadsData'
import { applySpreadsFromApi } from '../data/spreadsData'

export interface CardBackInfo {
  code: string
  name: string
  description: string | null
  assetUrl: string | null
  accessType: 'free' | 'vip' | 'paid'
  price: number | null
}

export interface ReferenceCore {
  cdnBase: string
  cards: TarotCard[]
  readers: ReaderInfo[]
  featuredReaders: ReaderInfo[]
  spreads: Spread[]
  readerSpreads: ReaderSpread[]
  cardBacks: CardBackInfo[]
}

export interface ReferenceBundle extends ReferenceCore {
  cardDetails?: Record<number, TarotCardDetail>
}

export const cardBacksList: Ref<CardBackInfo[]> = ref([])

let coreLoaded = false
let corePromise: Promise<void> | null = null
let cardDetailsLoaded = false
let cardDetailsPromise: Promise<void> | null = null

function applyReferenceCore(b: ReferenceCore) {
  applyTarotCardsFromApi(b.cards ?? [], b.cdnBase)
  applyReadersFromApi(b.readers ?? [])
  applyFeaturedReadersFromApi(b.featuredReaders ?? [])
  applySpreadsFromApi(b.spreads ?? [], b.readerSpreads ?? [])
  cardBacksList.value = b.cardBacks ?? []
}

async function fetchReferenceCore(): Promise<ReferenceCore> {
  try {
    const res = await api.get('/reference/core')
    if (!res.data?.success) throw new Error(res.data?.message || 'reference core failed')
    return res.data.data as ReferenceCore
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status
    if (status !== 404) throw err
    const res = await api.get('/reference/bundle')
    if (!res.data?.success) throw new Error(res.data?.message || 'reference bundle failed')
    return res.data.data as ReferenceBundle
  }
}

export async function loadReferenceCore(force = false): Promise<void> {
  if (coreLoaded && !force) return
  if (corePromise && !force) return corePromise
  corePromise = fetchReferenceCore()
    .then((b) => {
      applyReferenceCore(b)
      if ('cardDetails' in b && b.cardDetails) {
        applyTarotCardDetailsFromApi(b.cardDetails as Record<number, TarotCardDetail>)
        cardDetailsLoaded = true
      }
      coreLoaded = true
    })
    .finally(() => {
      corePromise = null
    })
  return corePromise
}

export async function loadTarotCardDetails(force = false): Promise<void> {
  if (cardDetailsLoaded && !force) return
  if (cardDetailsPromise && !force) return cardDetailsPromise
  cardDetailsPromise = (async () => {
    try {
      const res = await api.get('/reference/card-details')
      if (!res.data?.success) throw new Error(res.data?.message || 'card details failed')
      applyTarotCardDetailsFromApi((res.data.data?.cardDetails ?? {}) as Record<number, TarotCardDetail>)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status !== 404) throw err
      const res = await api.get('/reference/bundle')
      if (!res.data?.success) throw new Error(res.data?.message || 'reference bundle failed')
      const b = res.data.data as ReferenceBundle
      applyReferenceCore(b)
      applyTarotCardDetailsFromApi(b.cardDetails ?? {})
    }
    cardDetailsLoaded = true
  })().finally(() => {
    cardDetailsPromise = null
  })
  return cardDetailsPromise
}

export async function loadReferenceBundle(force = false): Promise<void> {
  await loadReferenceCore(force)
}
