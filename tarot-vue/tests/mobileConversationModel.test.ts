import test from 'node:test'
import assert from 'node:assert/strict'
import { conversationPresentation } from '../src/mobile/mobileConversationModel'
import type { MobileHistoryEntry } from '../src/mobile/types'

function entry(resultData: unknown, answer = ''): MobileHistoryEntry {
  return { id: 61, type: 'reader-reading', question: '如何看待当前的选择？', cardIds: [0], orientations: ['upright'],
    answer, resultData, readerId: 'qinghe', spreadType: 'single', createdAt: '2026-10-29T00:00:00Z' }
}

test('web-style conversation preserves all original reader turns, order and repeated text without appending a summary', () => {
  const messages = [
    { type: 'greeting', content: '你好，先看看这张牌。' },
    { type: 'reveal', content: '你抽到了愚者正位。' },
    { type: 'reading', content: '  原样保留\n\n包括换行。  ' },
    { type: 'synthesis', content: '先确认条件。' },
    { type: 'closing', content: '先确认条件。' },
  ]
  const result = conversationPresentation(entry({ messages, summary: '不要额外加一张总结卡。', advice: '不要混入旧数据。' }, '不追加答案'))
  assert.deepEqual(result.messages, messages)
  assert.equal(result.cardsAfterMessage, 1)
  assert.equal(result.hasOriginalMessages, true)
})

test('the card strip is inserted only after the first reveal, or before reader messages when none was saved', () => {
  const result = conversationPresentation(entry({ messages: [
    { type: 'greeting', content: '开场' }, { type: 'reveal', content: '第一次揭牌' },
    { type: 'reading', content: '解读' }, { type: 'reveal', content: '后来的揭牌文本' },
  ] }))
  assert.equal(result.cardsAfterMessage, 1)
  assert.equal(result.messages.length, 4)
  assert.equal(conversationPresentation(entry({ messages: [{ type: 'reading', content: '没有揭牌消息的原文' }] })).cardsAfterMessage, -1)
  const variant = conversationPresentation(entry({ messages: [{ type: ' REVEAL ', content: '原类型空格保留' }] }))
  assert.equal(variant.cardsAfterMessage, 0)
  assert.equal(variant.messages[0]!.type, ' REVEAL ')
})

test('malformed message rows are ignored but unknown valid turns remain visible and preserve their content', () => {
  const result = conversationPresentation(entry({ messages: [null, 'text', [], { content: 4 }, { content: '   ' },
    { type: 'provider-extension', content: '<strong>保留为纯文本</strong>' }, { type: 3, content: '类型未知的内容' },
  ] }))
  assert.deepEqual(result.messages, [
    { type: 'provider-extension', content: '<strong>保留为纯文本</strong>' },
    { type: 'unknown', content: '类型未知的内容' },
  ])
  assert.equal(result.hasOriginalMessages, true)
})

test('legacy fields become reader turns in saved order and exact duplicates are omitted', () => {
  const result = conversationPresentation(entry({ interpretation: '原牌义', advice: '原行动建议', conclusion: '原结论',
    cardReadings: [{ summary: '第一张原文' }, null, { summary: '原牌义' }, { summary: '第二张原文' }],
    sections: { overall: '整体原文', duplicate: '原结论', invalid: 7 }, summary: '已有正文时不添加摘要',
  }, '已有正文时不添加答案'))
  assert.deepEqual(result.messages.map(message => message.content), ['原牌义', '原行动建议', '原结论', '第一张原文', '第二张原文', '整体原文'])
  assert.deepEqual(result.messages.map(message => message.type), ['interpretation', 'advice', 'conclusion', 'card', 'card', 'overall'])
  assert.equal(result.cardsAfterMessage, -1)
  assert.equal(result.hasOriginalMessages, false)
})

test('old JSON text and daily section records use saved text without inventing reader bookends', () => {
  const result = conversationPresentation(entry(JSON.stringify({ sections: { intro: '开场原文', love: '关系原文' } })))
  assert.deepEqual(result.messages, [{ type: 'intro', content: '开场原文' }, { type: 'love', content: '关系原文' }])
  assert.equal(result.messages.some(message => message.type === 'greeting' || message.type === 'closing'), false)
})

test('only when no original or legacy content remains, summary or saved answer provides one fallback turn', () => {
  assert.deepEqual(conversationPresentation(entry({ messages: [{ content: '' }], summary: '唯一摘要' }, '旧答案')).messages,
    [{ type: 'summary', content: '唯一摘要' }])
  assert.deepEqual(conversationPresentation(entry('{invalid', '原记录答案')).messages, [{ type: 'answer', content: '原记录答案' }])
  assert.deepEqual(conversationPresentation(entry(null)).messages, [])
  assert.deepEqual(conversationPresentation(entry([])).messages, [])
})
