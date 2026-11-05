import { validDraft } from './mobileModel'
import type { MobileDraft } from './types'

export interface AskResumeItem {
  id: string
  kind: 'draft' | 'reading' | 'pending' | 'failed'
  title: string
  description: string
  detail?: string
}

/** Reader and spread preferences alone do not create a resumable question. */
export function hasAskDraftProgress(draft: MobileDraft): boolean {
  if (draft.phase === 'result') return false
  return Boolean(draft.question.trim() || draft.carried || draft.selected.length || draft.revealed.length ||
    ((draft.phase === 'select' || draft.phase === 'reveal') && draft.deck.length))
}

function cloneDraft(draft: MobileDraft): MobileDraft {
  return {
    schema: 1,
    owner: draft.owner,
    question: draft.question,
    count: draft.count,
    readerId: draft.readerId,
    carried: draft.carried ? { ...draft.carried } : null,
    deck: draft.deck.map(card => ({ ...card })),
    selected: [...draft.selected],
    revealed: [...draft.revealed],
    phase: draft.phase,
    ...(draft.readingId === undefined ? {} : { readingId: draft.readingId }),
    savedAt: draft.savedAt,
  }
}

/** Keep order and orientation: both are part of the original draw. */
function draftContent(draft: MobileDraft): string {
  return JSON.stringify([
    draft.owner, draft.question, draft.count, draft.readerId,
    draft.carried ? [draft.carried.id, draft.carried.isReversed] : null,
    draft.deck.map(card => [card.id, card.isReversed]), draft.selected, draft.revealed,
    draft.phase, draft.readingId ?? null,
  ])
}

/** A compact rendering key; full content, rather than its hash, handles deduplication. */
export function askDraftKey(draft: MobileDraft): string {
  const content = draftContent(draft)
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < content.length; index++) {
    const code = content.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `draft-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

export function validSavedAskDrafts(value: unknown, owner: number | null): MobileDraft[] {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, MobileDraft>()
  for (const candidate of value) {
    if (!validDraft(candidate, owner) || !hasAskDraftProgress(candidate)) continue
    const key = draftContent(candidate)
    const previous = unique.get(key)
    if (!previous || candidate.savedAt > previous.savedAt) unique.set(key, candidate)
  }
  return [...unique.values()].sort((left, right) => right.savedAt - left.savedAt).map(cloneDraft)
}

export function mergeSavedAskDrafts(existing: unknown, incoming: MobileDraft[], owner: number | null): MobileDraft[] {
  return validSavedAskDrafts([...(Array.isArray(existing) ? existing : []), ...incoming], owner)
}

export function blankAskDraft(owner: number | null, readerId: string, now = Date.now()): MobileDraft {
  return {
    schema: 1, owner, question: '', count: 1, readerId, carried: null,
    deck: [], selected: [], revealed: [], phase: 'question', savedAt: now,
  }
}
