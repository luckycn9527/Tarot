/** 牌面列表由启动时 GET /api/reference/bundle 注入，不在前端写死全量数据 */
import { PUBLIC_OSS_ASSET_ORIGIN, ossAssetUrl as toOssAssetUrl } from '@/utils/publicAssetUrl'

export interface TarotCard {
  id: number
  name: string
  nameEn: string
  uprightKeywords: string
  reversedKeywords: string
  yesNoTendency: 'yes' | 'no' | 'neutral'
  imageUrl?: string | null
}

function ossAssetUrl(value: string | null | undefined): string {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/uploads/')) return toOssAssetUrl(s)
  return s
}

export let CDN_BASE = `${PUBLIC_OSS_ASSET_ORIGIN}/uploads/cards`

/**
 * 获取卡面图片 URL：如果管理后台上传了自定义图片则优先使用，否则走本地 uploads 默认路径
 */
export function getCardImageUrl(nameEn: string, card?: TarotCard): string {
  if (card?.imageUrl) return ossAssetUrl(card.imageUrl)
  const found = tarotCards.find(c => c.nameEn === nameEn)
  if (found?.imageUrl) return ossAssetUrl(found.imageUrl)
  return `${CDN_BASE}/${nameEn.replace(/ /g, '_')}.jpg`
}

export function getCardSlug(nameEn: string): string {
  return nameEn.toLowerCase().replace(/ /g, '-')
}

export const tarotCards: TarotCard[] = []

export function findCardBySlug(slug: string): TarotCard | undefined {
  return tarotCards.find(c => getCardSlug(c.nameEn) === slug)
}

export function applyTarotCardsFromApi(cards: TarotCard[], cdnBase?: string) {
  if (cdnBase) CDN_BASE = ossAssetUrl(cdnBase)
  tarotCards.splice(0, tarotCards.length, ...cards)
}
