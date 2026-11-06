export const FEEDBACK_LIMITS = { minContent: 10, maxContent: 2000, maxContact: 100 } as const

export type FeedbackDelivery = 'sent' | 'unsent' | 'legacyunknown'
export interface FeedbackRecord {
  id: string
  type: string
  email: string
  content: string
  time: string
  delivery: FeedbackDelivery
  serverId?: string | number
}

export function normalizeFeedbackHistory(value: unknown): FeedbackRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || typeof item.content !== 'string') return []
    return [{
      id: typeof item.id === 'string' ? item.id : `legacy-${index}`,
      type: typeof item.type === 'string' ? item.type : 'other',
      email: typeof item.email === 'string' ? item.email : '',
      content: item.content,
      time: typeof item.time === 'string' ? item.time : '',
      // Old versions recorded both rejected and accepted requests identically.
      delivery: item.delivery === 'sent' || item.delivery === 'unsent' ? item.delivery : 'legacyunknown',
      ...(typeof item.serverId === 'number' || typeof item.serverId === 'string' ? { serverId: item.serverId } : {}),
    } satisfies FeedbackRecord]
  }).slice(0, 20)
}

export function createFeedbackState(history: unknown = []) {
  return {
    feedbackType: 'suggestion',
    email: '',
    content: '',
    isSubmitting: false,
    outcome: 'idle' as 'idle' | 'sent' | 'failed',
    localSaved: null as boolean | null,
    validation: null as 'content' | 'contact' | null,
    draftId: null as string | null,
    history: normalizeFeedbackHistory(history),
  }
}

export type FeedbackState = ReturnType<typeof createFeedbackState>
interface SubmissionDependencies {
  send: (payload: { type: string; content: string; contact?: string }) => Promise<unknown>
  writeHistory: (records: FeedbackRecord[]) => void
  readHistory: () => unknown
  createId: () => string
  now?: () => string
  captureScope?: () => (() => boolean)
}

export function isValidFeedback(state: Pick<FeedbackState, 'content' | 'email'>): boolean {
  const length = state.content.trim().length
  return length >= FEEDBACK_LIMITS.minContent && length <= FEEDBACK_LIMITS.maxContent && state.email.trim().length <= FEEDBACK_LIMITS.maxContact
}

/** No background resend: only the explicit submit call can issue a request. */
export function createFeedbackSubmitter(state: FeedbackState, dependencies: SubmissionDependencies) {
  let sessionVersion = 0

  function resetSession(history: unknown) {
    sessionVersion++
    Object.assign(state, createFeedbackState(history))
  }

  function persist(record: FeedbackRecord) {
    state.history = [record, ...state.history.filter(item => item.id !== record.id)].slice(0, 20)
    try {
      dependencies.writeHistory(state.history)
      // The shared storage wrapper intentionally swallows quota/private-mode errors.
      // Read back before claiming that a local draft/history was saved.
      const stored = normalizeFeedbackHistory(dependencies.readHistory()).find(item => item.id === record.id)
      return stored?.delivery === record.delivery && stored.content === record.content && stored.email === record.email && stored.type === record.type && stored.time === record.time
    } catch {
      return false
    }
  }

  async function submit() {
    if (state.isSubmitting) return 'busy' as const
    if (!isValidFeedback(state)) {
      state.validation = state.email.trim().length > FEEDBACK_LIMITS.maxContact ? 'contact' : 'content'
      return 'invalid' as const
    }
    state.isSubmitting = true
    state.outcome = 'idle'
    state.localSaved = null
    state.validation = null
    const version = sessionVersion
    const scopeIsCurrent = dependencies.captureScope?.() ?? (() => true)
    const isCurrent = () => version === sessionVersion && scopeIsCurrent()
    const record: FeedbackRecord = {
      id: state.draftId ?? dependencies.createId(),
      type: state.feedbackType,
      email: state.email.trim(),
      content: state.content.trim(),
      time: dependencies.now?.() ?? new Date().toISOString(),
      delivery: 'unsent',
    }
    state.draftId = record.id
    let response: unknown
    try {
      response = await dependencies.send({
        type: record.type === 'suggestion' ? 'feature' : record.type === 'content' ? 'other' : record.type,
        content: record.content,
        contact: record.email || undefined,
      })
      // Production currently returns { success: true, data: null }; an ID is optional.
      if (!response || typeof response !== 'object' || !('success' in response) || response.success !== true) {
        throw new Error('Feedback was not confirmed')
      }
    } catch {
      // The account watcher resets the form/history for its new owner. A late
      // response must not save the previous owner's text or unlock a new request.
      if (!isCurrent()) return 'stale' as const
      state.localSaved = persist(record)
      state.outcome = 'failed'
      state.isSubmitting = false
      return 'failed' as const
    }

    if (!isCurrent()) return 'stale' as const

    record.delivery = 'sent'
    if ('data' in response && response.data && typeof response.data === 'object' && 'id' in response.data) {
      const id = response.data.id
      if (typeof id === 'string' || typeof id === 'number') record.serverId = id
    }
    // A local persistence failure must never turn a confirmed server success into
    // a retryable failure (which could cause a duplicate submission).
    state.localSaved = persist(record)
    state.content = ''
    state.email = ''
    state.draftId = null
    state.outcome = 'sent'
    state.isSubmitting = false
    return 'sent' as const
  }

  function restoreDraft(record: FeedbackRecord) {
    if (state.isSubmitting || record.delivery !== 'unsent') return
    state.feedbackType = record.type
    state.email = record.email
    state.content = record.content
    state.draftId = record.id
    state.outcome = 'idle'
    state.validation = null
    state.localSaved = null
  }

  return { submit, restoreDraft, resetSession }
}
