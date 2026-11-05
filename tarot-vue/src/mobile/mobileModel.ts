import type { MobileCard, MobileDraft, MobileHistoryEntry, PendingMobileTask, MobileReadingPayload, MobileFollowupPayload } from './types'

function random() { return crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296 }
export function mobileDeck(ids: readonly number[], sample: () => number = random): MobileCard[] {
  const unique = [...new Set(ids.filter(id => Number.isInteger(id) && id >= 0 && id < 78))]
  for (let i = unique.length - 1; i > 0; i--) { const j = Math.floor(sample() * (i + 1)); [unique[i], unique[j]] = [unique[j]!, unique[i]!] }
  return unique.map(id => ({ id, isReversed: sample() < .5 }))
}
export function questionValid(value: string) { return value.trim().length >= 5 && value.trim().length <= 200 }
export function followupValid(value: string) { return value.trim().length >= 2 && value.trim().length <= 200 }
export function historyObject(entry: MobileHistoryEntry): Record<string, unknown> {
  const raw = entry.resultData
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string') { try { const parsed: unknown = JSON.parse(raw); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown> } catch { /* old invalid JSON has no display fields */ } }
  return {}
}
export function savedFollowups(entry: MobileHistoryEntry) {
  const value = historyObject(entry).followups
  return Array.isArray(value) ? value.filter((row): row is { question: string; answer: string; at?: string } => !!row && typeof row.question === 'string' && typeof row.answer === 'string') : []
}
export function savedMessages(entry: MobileHistoryEntry) {
  const data = historyObject(entry)
  const messages = Array.isArray(data.messages) ? data.messages.filter((row): row is { type: string; content: string } => !!row && typeof row.content === 'string') : []
  const visible = messages.filter(row => row.type !== 'greeting' && row.type !== 'closing')
  if (visible.length) return visible
  const legacy: { type: string; content: string }[] = []
  for (const field of ['interpretation','advice','conclusion']) if (typeof data[field] === 'string' && data[field]) legacy.push({ type: field, content: data[field] as string })
  if (Array.isArray(data.cardReadings)) for (const item of data.cardReadings) {
    if (item && typeof item.summary === 'string') legacy.push({ type: 'card', content: item.summary })
  }
  if (data.sections && typeof data.sections === 'object' && !Array.isArray(data.sections)) for (const [type, content] of Object.entries(data.sections)) {
    if (typeof content === 'string' && content) legacy.push({ type, content })
  }
  return legacy
}
export function savedSummary(entry: MobileHistoryEntry) {
  const summary = historyObject(entry).summary
  if (typeof summary === 'string' && summary.trim()) return summary
  const data = historyObject(entry)
  if (typeof data.conclusion === 'string' && data.conclusion.trim()) return data.conclusion
  return entry.answer
}
export function validDraft(value: unknown, owner: number | null): value is MobileDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as MobileDraft
  const card = (item: MobileCard) => !!item && Number.isInteger(item.id) && item.id >= 0 && item.id < 78 && typeof item.isReversed === 'boolean'
  return draft.schema === 1 && draft.owner === owner && typeof draft.question === 'string' && draft.question.length <= 200 &&
    (draft.count === 1 || draft.count === 3) && typeof draft.readerId === 'string' && ['question', 'select', 'reveal', 'result'].includes(draft.phase) &&
    (draft.phase !== 'result' || (owner !== null && Number.isSafeInteger(draft.readingId) && Number(draft.readingId) > 0)) &&
    Number.isFinite(draft.savedAt) && draft.savedAt > Date.now() - 7 * 86400000 &&
    (draft.carried === null || (card(draft.carried) && draft.count === 1)) && Array.isArray(draft.deck) && draft.deck.length <= 78 && draft.deck.every(card) &&
    new Set(draft.deck.map(row => row.id)).size === draft.deck.length &&
    Array.isArray(draft.selected) && draft.selected.length <= draft.count && new Set(draft.selected).size === draft.selected.length &&
    draft.selected.every(id => draft.deck.some(row => row.id === id)) &&
    Array.isArray(draft.revealed) && new Set(draft.revealed).size === draft.revealed.length && draft.revealed.every(id => draft.selected.includes(id) || draft.carried?.id === id)
}
export function validPendingTask(value: unknown, owner: number | null): value is PendingMobileTask {
  if (!value || typeof value !== 'object' || owner === null) return false
  const task = value as PendingMobileTask
  if (task.schema !== 1 || task.owner !== owner || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(task.requestId) || !Number.isFinite(task.createdAt) || !task.payload) return false
  if (task.payload.locale !== 'zh-CN' && task.payload.locale !== 'en-US') return false
  if (task.kind === 'followup') { const data = task.payload as MobileFollowupPayload; return Number.isSafeInteger(data.readingId) && data.readingId > 0 && typeof data.question === 'string' && followupValid(data.question) }
  if (task.kind !== 'reading') return false
  const data = task.payload as MobileReadingPayload
  return typeof data.question === 'string' && questionValid(data.question) && typeof data.readerId === 'string' && !!data.readerId &&
    ['single','problem','timeline'].includes(data.spreadType) && Array.isArray(data.cardIds) && data.cardIds.length === (data.spreadType === 'single' ? 1 : 3) &&
    data.cardIds.every(id => Number.isInteger(id) && id >= 0 && id < 78) && new Set(data.cardIds).size === data.cardIds.length &&
    Array.isArray(data.orientations) && data.orientations.length === data.cardIds.length && data.orientations.every(value => value === 'upright' || value === 'reversed')
}
