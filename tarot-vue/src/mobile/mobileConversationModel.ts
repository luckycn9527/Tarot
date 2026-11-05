import { historyObject } from './mobileModel'
import type { MobileHistoryEntry } from './types'

export interface MobileConversationMessage {
  type: string
  content: string
}

export interface MobileConversationPresentation {
  messages: MobileConversationMessage[]
  /** -1 places the card strip before the reader messages; otherwise after this message. */
  cardsAfterMessage: number
  hasOriginalMessages: boolean
}

const hasText = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())

export function conversationPresentation(entry: MobileHistoryEntry): MobileConversationPresentation {
  const data = historyObject(entry)
  const original: MobileConversationMessage[] = []
  if (Array.isArray(data.messages)) for (const value of data.messages) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !hasText(value.content)) continue
    original.push({ type: typeof value.type === 'string' ? value.type : 'unknown', content: value.content })
  }

  if (original.length) return {
    messages: original,
    cardsAfterMessage: original.findIndex(message => message.type.trim().toLowerCase() === 'reveal'),
    hasOriginalMessages: true,
  }

  const messages: MobileConversationMessage[] = []
  const seen = new Set<string>()
  function append(type: string, value: unknown) {
    if (!hasText(value) || seen.has(value)) return
    seen.add(value)
    messages.push({ type, content: value })
  }

  for (const type of ['interpretation', 'advice', 'conclusion']) append(type, data[type])
  if (Array.isArray(data.cardReadings)) for (const card of data.cardReadings) {
    if (card && typeof card === 'object' && !Array.isArray(card)) append('card', card.summary)
  }
  if (data.sections && typeof data.sections === 'object' && !Array.isArray(data.sections)) {
    for (const [type, value] of Object.entries(data.sections)) append(type, value)
  }
  if (!messages.length) {
    if (hasText(data.summary)) append('summary', data.summary)
    else append('answer', entry.answer)
  }
  return { messages, cardsAfterMessage: -1, hasOriginalMessages: false }
}
