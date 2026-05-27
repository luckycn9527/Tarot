/** 牌阵元数据由 GET /api/reference/bundle 注入 */
export interface SpreadPosition {
  index: number
  name: string
  description: string
}

export interface Spread {
  id: string
  name: string
  emoji: string
  cardCount: number
  description: string
  whenToUse: string
  positions: SpreadPosition[]
}

export const spreads: Spread[] = []

export interface ReaderSpread {
  id: string
  name: string
  cardCount: number
  description: string
  emoji: string
  positions: string[]
}

export const readerSpreads: ReaderSpread[] = []

export function getReaderSpreadById(id: string): ReaderSpread | undefined {
  return readerSpreads.find(s => s.id === id)
}

export function applySpreadsFromApi(
  spreadList: Spread[],
  readerSpreadList: ReaderSpread[],
) {
  spreads.splice(0, spreads.length, ...spreadList)
  readerSpreads.splice(0, readerSpreads.length, ...readerSpreadList)
}
