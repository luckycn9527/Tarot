import test from 'node:test'
import assert from 'node:assert/strict'
import { readingPresentation } from '../src/mobile/mobileReadingPresentation'
import type { MobileHistoryEntry } from '../src/mobile/types'

function entry(resultData: unknown, answer = '', type: MobileHistoryEntry['type'] = 'reader-reading'): MobileHistoryEntry {
  return { id: 42, type, question: '如何理解当前的机会？', cardIds: [0], orientations: ['reversed'], answer, resultData,
    readerId: 'qinghe', spreadType: 'single', createdAt: '2026-10-29T00:00:00Z' }
}
const textOnly = (value: string) => value.replace(/\s+/g, '')

test('reader result keeps saved semantic sections while excluding conversational bookends and exact duplicates', () => {
  const result = readingPresentation(entry({ summary: '  先核对目标，再行动。 ', messages: [
    { type: 'greeting', content: '你好。' },
    { type: 'reveal', content: '愚者，逆位。' },
    { type: 'reading', content: '尚未确认的条件需要留意。\n\n先询问工作内容。' },
    { type: 'reading', content: '尚未确认的条件需要留意。   先询问工作内容。' },
    { type: 'synthesis', content: '安排一次具体的沟通。' },
    { type: 'synthesis', content: '先核对目标，再行动。' },
    { type: 'closing', content: '下次再聊。' },
  ] }), false)
  assert.equal(result.summary, '先核对目标，再行动。')
  assert.deepEqual(result.sections.map(section => section.title), ['牌面信息', '牌面解读', '综合建议'])
  assert.deepEqual(result.sections[1]!.paragraphs, ['尚未确认的条件需要留意。', '先询问工作内容。'])
  assert.deepEqual(result.sections[2]!.paragraphs, ['安排一次具体的沟通。'])
})

test('missing advice stays missing and unknown saved message types remain visible as plain content', () => {
  const result = readingPresentation(entry({ messages: [{ type: 'new-provider-section', content: '<b>原样保留的文字</b>' }] }, '已保存的结论'), true)
  assert.equal(result.summary, '已保存的结论')
  assert.deepEqual(result.sections, [{ id: 'other-1', title: 'Interpretation', paragraphs: ['<b>原样保留的文字</b>'] }])
  assert.equal(result.sections.some(section => section.title === 'Suggested action'), false)
})

test('legacy three-card detail preserves all distinct cards and only uses actual saved advice', () => {
  const result = readingPresentation(entry({ interpretation: '整体牌面解释。', advice: '先把条件写下来。', conclusion: '原有结论。',
    cardReadings: [{ summary: '第一张：起因。' }, { summary: '第二张：现状。' }, { summary: '第三张：解法。' }],
  }, '是', 'three-card'), false)
  assert.equal(result.summary, '原有结论。')
  assert.deepEqual(result.sections.map(section => section.title), ['牌面解读', '行动建议', '牌面解读'])
  assert.deepEqual(result.sections[2]!.paragraphs, ['第一张：起因。', '第二张：现状。', '第三张：解法。'])
})

test('legacy daily sections have readable localized headings without adding ratings or guidance', () => {
  const result = readingPresentation(entry({ sections: { intro: '一天的开场。', overall: '整体内容。', love: '关系内容。', career: '工作内容。', wealth: '财务内容。', health: '健康内容。', mystery: '额外启发。' }, ratings: { overall: 5 } }, '', 'daily-fortune'), true)
  assert.equal(result.summary, '')
  assert.deepEqual(result.sections.map(section => section.title), ['Today’s insight', 'Overall outlook', 'Love and relationships', 'Work and study', 'Finances', 'Health', 'Further insight'])
  assert.equal(result.sections.flatMap(section => section.paragraphs).length, 7)
})

test('old JSON text, invalid JSON and absent summary fall back to existing saved content without duplication', () => {
  assert.deepEqual(readingPresentation(entry('{invalid', '原记录答案'), false), { summary: '原记录答案', sections: [] })
  const result = readingPresentation(entry(JSON.stringify({ summary: '仅有结论', messages: [null, { type: 'reading', content: '仅有结论' }, { content: 1 }, { type: 'reading', content: '另一段内容' }] })), false)
  assert.equal(result.summary, '仅有结论')
  assert.deepEqual(result.sections[0]!.paragraphs, ['另一段内容'])
})

test('long Chinese and English paragraphs break at sentences without losing saved text', () => {
  for (const [english, content] of [
    [false, '先观察当前环境，再确认自己的节奏。'.repeat(60)],
    [true, 'Observe the situation carefully before deciding on the next small step. '.repeat(35)],
  ] as const) {
    const result = readingPresentation(entry({ summary: 'Summary', messages: [{ type: 'reading', content }] }), english)
    const parts = result.sections[0]!.paragraphs
    assert.ok(parts.length > 1)
    assert.equal(textOnly(parts.join('')), textOnly(content))
    assert.ok(parts.every(part => part.length <= (english ? 500 : 220)))
  }
  const singleSentence = '没有自然句界的原文'.repeat(80)
  const unchanged = readingPresentation(entry({ messages: [{ type: 'reading', content: singleSentence }] }), false)
  assert.deepEqual(unchanged.sections[0]!.paragraphs, [singleSentence])
})

test('saved message order and line breaks are retained across differing section types', () => {
  const result = readingPresentation(entry({ messages: [
    { type: 'reading', content: '甲\r\n乙\r丙' },
    { type: 'synthesis', content: '中间的综合内容' },
    { type: 'reading', content: '最后的牌面内容' },
  ] }), false)
  assert.deepEqual(result.sections.map(section => section.title), ['牌面解读', '综合建议', '牌面解读'])
  assert.deepEqual(result.sections[0]!.paragraphs, ['甲', '乙', '丙'])
  assert.equal(result.sections[2]!.paragraphs[0], '最后的牌面内容')
})
