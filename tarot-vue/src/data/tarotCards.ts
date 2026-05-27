/** 牌面列表由启动时 GET /api/reference/bundle 注入，不在前端写死全量数据 */
export interface TarotCard {
  id: number
  name: string
  nameEn: string
  uprightKeywords: string
  reversedKeywords: string
  yesNoTendency: 'yes' | 'no' | 'neutral'
  imageUrl?: string | null
}

export let CDN_BASE = 'https://cdn.tarotqa.com/images-optimized/tarot'

/**
 * 获取卡面图片 URL：如果管理后台上传了自定义图片则优先使用，否则走 CDN 默认路径
 */
export function getCardImageUrl(nameEn: string, card?: TarotCard): string {
  if (card?.imageUrl) return card.imageUrl
  const found = tarotCards.find(c => c.nameEn === nameEn)
  if (found?.imageUrl) return found.imageUrl
  return `${CDN_BASE}/${nameEn.replace(/ /g, '_')}.webp`
}

export function getCardSlug(nameEn: string): string {
  return nameEn.toLowerCase().replace(/ /g, '-')
}

export const tarotCards: TarotCard[] = []

export function findCardBySlug(slug: string): TarotCard | undefined {
  return tarotCards.find(c => getCardSlug(c.nameEn) === slug)
}

export function applyTarotCardsFromApi(cards: TarotCard[], cdnBase?: string) {
  if (cdnBase) CDN_BASE = cdnBase
  tarotCards.splice(0, tarotCards.length, ...cards)
}
