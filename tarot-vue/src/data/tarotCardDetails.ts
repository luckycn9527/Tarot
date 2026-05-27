/** 详情文案由 GET /api/reference/bundle 注入 */
export interface TarotCardDetail {
  description: string
  uprightMeaning: string
  reversedMeaning: string
  symbolism: string
  loveAdvice: string
  careerAdvice: string
}

export let tarotCardDetails: Record<number, TarotCardDetail> = {}

export function applyTarotCardDetailsFromApi(details: Record<number, TarotCardDetail>) {
  tarotCardDetails = { ...details }
}
