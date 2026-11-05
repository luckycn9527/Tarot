import api, { publicApi } from './api'

export interface SharedReading {
  type: string
  question: string | null
  cardIds: number[]
  orientations: string[]
  answer: string | null
  resultData: unknown
  readingDate: string
  viewCount: number
}

export interface ReadingShareSummary {
  shareCode: string
  readingId: number
  viewCount: number
  createdAt: string
  type: string
  question: string
}

export async function createReadingShare(readingId: number): Promise<string> {
  const res = await api.post('/shares', { readingId })
  if (!res.data?.success || typeof res.data?.data?.shareCode !== 'string') {
    throw new Error(res.data?.message || 'Failed to create share link')
  }
  return res.data.data.shareCode
}

export async function fetchMyReadingShares(): Promise<ReadingShareSummary[]> {
  const res = await api.get('/shares/mine')
  if (!res.data?.success || !Array.isArray(res.data?.data)) {
    throw new Error(res.data?.message || 'Failed to load share links')
  }
  return res.data.data.map((row: Record<string, unknown>) => ({
    shareCode: String(row.share_code ?? ''),
    readingId: Number(row.reading_id),
    viewCount: Number(row.view_count ?? 0),
    createdAt: String(row.created_at ?? ''),
    type: String(row.type ?? ''),
    question: String(row.question ?? ''),
  })).filter((row: ReadingShareSummary) => row.shareCode && Number.isInteger(row.readingId))
}

export async function revokeReadingShare(shareCode: string): Promise<void> {
  const res = await api.delete(`/shares/${encodeURIComponent(shareCode)}`)
  if (!res.data?.success) throw new Error(res.data?.message || 'Failed to revoke share link')
}

export async function fetchSharedReading(shareCode: string): Promise<SharedReading> {
  const res = await publicApi.get(`/shares/${encodeURIComponent(shareCode)}`)
  if (!res.data?.success) throw new Error(res.data?.message || 'Shared reading not found')
  return res.data.data as SharedReading
}

export function readingShareUrl(shareCode: string): string {
  return new URL(`/share/${encodeURIComponent(shareCode)}`, window.location.origin).href
}
