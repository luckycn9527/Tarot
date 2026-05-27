/** 前端内存缓存 TTL（毫秒），与 Pinia 配合减少重复请求 */
export const CACHE_TTL_MS = {
  quota: 25_000,
  settings: 90_000,
  cemeteryMarkers: 120_000,
  cemeteryMyTombstone: 45_000,
  cemeteryTombstoneDetail: 50_000,
  cemeteryPosition: 10_000,
  readingHistory: 25_000,
} as const

export function isFresh(fetchedAt: number | null, ttlMs: number): boolean {
  return fetchedAt != null && Date.now() - fetchedAt < ttlMs
}
