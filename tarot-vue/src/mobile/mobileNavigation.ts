import type { MobileCard, MobileDraft, MobileFollowupPayload, MobileHistoryEntry, MobileTask, PendingMobileTask } from './types'

export interface MobileCompletionNotice {
  schema: 1; owner: number; requestId: string; kind: 'reading' | 'followup'; readingId: number
  question: string; completedAt: number; entry?: MobileHistoryEntry
}
export interface MobileHistoryReturn {
  schema: 1; owner: number; page: number; search: string; scrollY: number; savedAt: number
}
export interface MobileTaskFeedback { schema: 1; task: PendingMobileTask; message: string }
export interface MobileResponseScope { owner: number | null; sequence: number }
const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function taskReadingId(task: PendingMobileTask | null): number | undefined {
  return task?.kind === 'followup' ? (task.payload as MobileFollowupPayload).readingId : undefined
}
export function taskBelongsToReading(task: PendingMobileTask | null, owner: number | null, readingId: number | null | undefined) {
  return owner !== null && !!task && task.owner === owner && task.kind === 'followup' && taskReadingId(task) === readingId
}
export function taskMatchesDraw(task: PendingMobileTask, question: string, readerId: string, cards: MobileCard[]) {
  if (task.kind !== 'reading' || !('cardIds' in task.payload)) return false
  const payload = task.payload
  return payload.question === question.trim() && payload.readerId === readerId && payload.cardIds.length === cards.length &&
    cards.every((card, index) => payload.cardIds[index] === card.id && (payload.orientations[index] === 'reversed') === card.isReversed)
}
export function completedReadingId(status: MobileTask, task: PendingMobileTask): number | undefined {
  // A follow-up always belongs to its submitted record, even if a response has a wrong history ID.
  if (task.kind === 'followup') return taskReadingId(task)
  const id = status.historyId ?? (status.result && 'id' in status.result ? status.result.id : undefined)
  return Number.isSafeInteger(id) && Number(id) > 0 ? id : undefined
}
export function completionIsVisible(task: PendingMobileTask, owner: number | null, tab: string, phase: string, readingId?: number | null) {
  if (task.owner !== owner || tab !== 'ask') return false
  return task.kind === 'reading' ? phase === 'waiting' : phase === 'result' && taskBelongsToReading(task, owner, readingId)
}
export function validCompletionNotice(value: unknown, owner: number | null): value is MobileCompletionNotice {
  if (!value || typeof value !== 'object' || owner === null) return false
  const notice = value as MobileCompletionNotice
  return notice.schema === 1 && notice.owner === owner && requestIdPattern.test(notice.requestId) &&
    (notice.kind === 'reading' || notice.kind === 'followup') && Number.isSafeInteger(notice.readingId) && notice.readingId > 0 &&
    typeof notice.question === 'string' && notice.question.length <= 200 && Number.isFinite(notice.completedAt) &&
    (!notice.entry || notice.entry.id === notice.readingId)
}
export function validHistoryReturn(value: unknown, owner: number | null): value is MobileHistoryReturn {
  if (!value || typeof value !== 'object' || owner === null) return false
  const state = value as MobileHistoryReturn
  return state.schema === 1 && state.owner === owner && Number.isSafeInteger(state.page) && state.page > 0 &&
    typeof state.search === 'string' && state.search.length <= 200 && Number.isFinite(state.scrollY) && state.scrollY >= 0 && Number.isFinite(state.savedAt)
}
export function responseScopeIsCurrent(scope: MobileResponseScope, owner: number | null, sequence: number, disposed = false) {
  return !disposed && scope.owner === owner && scope.sequence === sequence
}
export function beginReadingRefresh(versions: Map<number, number>, readingId: number) {
  const version = (versions.get(readingId) ?? 0) + 1
  versions.set(readingId, version)
  return version
}
export function consumeFollowupDraft(drafts: Record<number, string>, activeReadingId: number | null, currentValue: string, readingId: number, submittedQuestion: string) {
  const retained = { ...drafts }
  if (retained[readingId]?.trim() === submittedQuestion) delete retained[readingId]
  return { drafts: retained, value: activeReadingId === readingId && currentValue.trim() === submittedQuestion ? '' : currentValue }
}
export function continueCardSelection(deck: MobileCard[], selected: number[], revealed: number[], count: 1 | 3) {
  const retained = selected.filter(id => deck.some(card => card.id === id)).slice(0, count)
  return { deck, selected: retained, revealed: revealed.filter(id => retained.includes(id)) }
}
export function previousDrawPhase(phase: string, carried: boolean): 'question' | 'select' {
  return phase === 'reveal' && !carried ? 'select' : 'question'
}
export function persistedDrawPhase(phase: string, activeReadingId: number | null): MobileDraft['phase'] {
  if (phase === 'result' && activeReadingId !== null) return 'result'
  return phase === 'question' || phase === 'select' || phase === 'reveal' ? phase : 'reveal'
}
