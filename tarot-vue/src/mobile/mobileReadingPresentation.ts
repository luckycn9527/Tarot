import { historyObject, savedSummary } from './mobileModel'
import type { MobileHistoryEntry } from './types'

export interface MobileReadingSection {
  id: string
  title: string
  paragraphs: string[]
}

export interface MobileReadingPresentation {
  summary: string
  sections: MobileReadingSection[]
}

const labels: Record<string, [string, string]> = {
  reveal: ['牌面信息', 'Cards revealed'],
  reading: ['牌面解读', 'Card interpretation'],
  synthesis: ['综合建议', 'Overall guidance'],
  advice: ['行动建议', 'Suggested action'],
  conclusion: ['结论', 'Conclusion'],
  intro: ['今日提示', 'Today’s insight'],
  overall: ['整体运势', 'Overall outlook'],
  love: ['关系与感情', 'Love and relationships'],
  career: ['工作与学习', 'Work and study'],
  wealth: ['财务', 'Finances'],
  health: ['健康', 'Health'],
  mystery: ['神秘启发', 'Further insight'],
  other: ['解读内容', 'Interpretation'],
}

function sectionKind(value: unknown) {
  const type = typeof value === 'string' ? value.toLowerCase().trim() : ''
  if (type === 'greeting' || type === 'closing') return null
  if (type === 'interpretation' || type === 'card') return 'reading'
  return Object.prototype.hasOwnProperty.call(labels, type) ? type : 'other'
}

function contentKey(value: string) { return value.replace(/\s+/g, ' ').trim() }

// Add reading breaks only at saved line breaks or natural sentence endings.
// A single long sentence remains intact instead of being truncated or reworded.
function paragraphs(value: string, english: boolean) {
  const limit = english ? 500 : 220
  return value.replace(/\r\n?/g, '\n').split(/\n+/).map(part => part.trim()).filter(Boolean).flatMap(part => {
    if (part.length <= limit) return [part]
    const sentenceEnds = /[。！？]+[”’"'」』）)\]]*|[!?]+[”’"'）)\]]*(?=\s|$)|\.+[”’"'）)\]]*(?=\s|$)/g
    const sentences: string[] = []
    let start = 0
    for (const match of part.matchAll(sentenceEnds)) {
      const end = match.index + match[0].length
      sentences.push(part.slice(start, end))
      start = end
    }
    if (start < part.length) sentences.push(part.slice(start))
    const result: string[] = []
    let group = ''
    for (const sentence of sentences) {
      if (group && group.length + sentence.length > limit) {
        result.push(group.trim())
        group = sentence
      } else group += sentence
    }
    if (group.trim()) result.push(group.trim())
    return result.length ? result : [part]
  })
}

export function readingPresentation(entry: MobileHistoryEntry, english: boolean): MobileReadingPresentation {
  const data = historyObject(entry)
  const saved = savedSummary(entry)
  const summary = typeof saved === 'string' ? saved.trim() : ''
  const seen = new Set(summary ? [contentKey(summary)] : [])
  const sections: MobileReadingSection[] = []
  let lastKind = ''

  function append(type: unknown, value: unknown) {
    const kind = sectionKind(type)
    if (!kind || typeof value !== 'string' || !value.trim()) return
    const key = contentKey(value)
    if (seen.has(key)) return
    seen.add(key)
    const body = paragraphs(value, english)
    if (!body.length) return
    if (lastKind === kind && sections.length) sections[sections.length - 1]!.paragraphs.push(...body)
    else sections.push({ id: `${kind}-${sections.length + 1}`, title: labels[kind]![english ? 1 : 0], paragraphs: body })
    lastKind = kind
  }

  if (Array.isArray(data.messages)) for (const message of data.messages) {
    if (message && typeof message === 'object' && !Array.isArray(message)) append(message.type, message.content)
  }
  for (const field of ['interpretation', 'advice', 'conclusion']) append(field, data[field])
  if (Array.isArray(data.cardReadings)) for (const card of data.cardReadings) {
    if (card && typeof card === 'object' && !Array.isArray(card)) append('card', card.summary)
  }
  if (data.sections && typeof data.sections === 'object' && !Array.isArray(data.sections)) {
    for (const [type, value] of Object.entries(data.sections)) append(type, value)
  }
  return { summary, sections }
}
