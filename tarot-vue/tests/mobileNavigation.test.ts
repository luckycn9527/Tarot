import test from 'node:test'
import assert from 'node:assert/strict'
import { beginReadingRefresh, completedReadingId, completionIsVisible, consumeFollowupDraft, continueCardSelection, isDrawLocked, persistedDrawPhase, previousDrawPhase, restoredDrawPhase, responseScopeIsCurrent, taskBelongsToReading, taskMatchesDraw, validCompletionNotice, validHistoryReturn } from '../src/mobile/mobileNavigation'
import { blankAskDraft } from '../src/mobile/mobileAskEntry'
import type { MobileCompletionNotice, MobileHistoryReturn } from '../src/mobile/mobileNavigation'
import type { MobileTask, PendingMobileTask } from '../src/mobile/types'

const owner = 71, readingA = 81, readingB = 82
const requestId = 'a319d6e2-c61b-46c7-9d75-59958950d448'
const followup: PendingMobileTask = { schema: 1, owner, requestId, kind: 'followup', createdAt: Date.now(), payload: { readingId: readingA, question: '接下来怎么办？', locale: 'zh-CN' } }
const reading: PendingMobileTask = { ...followup, kind: 'reading', payload: { readerId: 'qinghe', spreadType: 'single', question: '我可以如何规划下一步？', category: '其他', cardIds: [0], orientations: ['upright'], locale: 'zh-CN' } }

test('pending follow-up and its completion remain attached to record A while viewing B', () => {
  assert.equal(taskBelongsToReading(followup, owner, readingA), true)
  assert.equal(taskBelongsToReading(followup, owner, readingB), false)
  assert.equal(taskBelongsToReading(followup, owner + 1, readingA), false)
  assert.equal(taskBelongsToReading(followup, null, readingA), false)
  assert.equal(completionIsVisible(followup, owner, 'ask', 'result', readingA), true)
  assert.equal(completionIsVisible(followup, owner, 'ask', 'result', readingB), false)
  assert.equal(completionIsVisible(followup, owner, 'history', 'result', readingA), false)
  const wrongHistoryResponse: MobileTask = { requestId, kind: 'followup', status: 'succeeded', historyId: readingB }
  assert.equal(completedReadingId(wrongHistoryResponse, followup), readingA)
})

test('a new reading completes in place only on its waiting screen', () => {
  assert.equal(completionIsVisible(reading, owner, 'ask', 'waiting'), true)
  assert.equal(completionIsVisible(reading, owner, 'ask', 'result', readingB), false)
  assert.equal(completionIsVisible(reading, owner, 'ask', 'question'), false)
  assert.equal(completionIsVisible(reading, owner + 1, 'ask', 'waiting'), false)
  assert.equal(completedReadingId({ requestId, kind: 'reading', status: 'succeeded', historyId: readingA }, reading), readingA)
  assert.equal(completedReadingId({ requestId, kind: 'reading', status: 'succeeded', historyId: -1 }, reading), undefined)
})

test('reading failure feedback is hidden when the question, reader, selected cards or orientation changes', () => {
  const card = { id: 0, isReversed: false }, question = reading.payload.question
  assert.equal(taskMatchesDraw(reading, question, 'qinghe', [card]), true)
  assert.equal(taskMatchesDraw(reading, '换一个问题看看？', 'qinghe', [card]), false)
  assert.equal(taskMatchesDraw(reading, question, 'another-reader', [card]), false)
  assert.equal(taskMatchesDraw(reading, question, 'qinghe', [{ ...card, id: 5 }]), false)
  assert.equal(taskMatchesDraw(reading, question, 'qinghe', [{ ...card, isReversed: true }]), false)
})

test('a restored completion notice has an account and a concrete record target', () => {
  const notice: MobileCompletionNotice = { schema: 1, owner, requestId, kind: 'followup', readingId: readingA, question: '接下来怎么办？', completedAt: Date.now() }
  assert.equal(validCompletionNotice(notice, owner), true)
  assert.equal(validCompletionNotice(notice, owner + 1), false)
  assert.equal(validCompletionNotice(notice, null), false)
  assert.equal(validCompletionNotice({ ...notice, readingId: undefined }, owner), false)
  assert.equal(validCompletionNotice({ ...notice, requestId: 'another-task' }, owner), false)
  assert.equal(validCompletionNotice({ ...notice, entry: { id: readingB } }, owner), false)
})

test('A finishing consumes only A submitted text and preserves B input and newer A text', () => {
  const drafts = { [readingA]: '接下来怎么办？', [readingB]: '我应该如何沟通？' }
  const fromB = consumeFollowupDraft(drafts, readingB, drafts[readingB]!, readingA, drafts[readingA]!)
  assert.equal(fromB.value, drafts[readingB]); assert.equal(fromB.drafts[readingB], drafts[readingB]); assert.equal(fromB.drafts[readingA], undefined)
  assert.equal(drafts[readingA], '接下来怎么办？')
  assert.equal(consumeFollowupDraft(drafts, readingA, drafts[readingA]!, readingA, drafts[readingA]!).value, '')
  assert.equal(consumeFollowupDraft({ [readingA]: '新的想法' }, readingA, '新的想法', readingA, '接下来怎么办？').value, '新的想法')
})

test('history return stores page, search and scroll and rejects a different account', () => {
  const state: MobileHistoryReturn = { schema: 1, owner, page: 3, search: '工作', scrollY: 860, savedAt: Date.now() }
  assert.equal(validHistoryReturn(state, owner), true)
  assert.deepEqual([state.page, state.search, state.scrollY], [3, '工作', 860])
  assert.equal(validHistoryReturn(state, owner + 1), false)
  assert.equal(validHistoryReturn({ ...state, scrollY: -1 }, owner), false)
  assert.equal(validHistoryReturn({ ...state, page: 0 }, owner), false)
})

test('an uncached result still persists its record target before the detail request completes', () => {
  assert.equal(persistedDrawPhase('result', readingB), 'result')
  assert.equal(persistedDrawPhase('waiting', null), 'reveal')
  assert.equal(persistedDrawPhase('select', null), 'select')
})

test('late details/history responses cannot commit after navigation, account switch or disposal', () => {
  const scope = { owner, sequence: 4 }
  assert.equal(responseScopeIsCurrent(scope, owner, 4), true)
  assert.equal(responseScopeIsCurrent(scope, owner, 5), false)
  assert.equal(responseScopeIsCurrent(scope, owner + 1, 4), false)
  assert.equal(responseScopeIsCurrent(scope, owner, 4, true), false)
})

test('a delayed refresh from the first follow-up cannot replace the second completed follow-up', async () => {
  const versions = new Map<number, number>()
  let resolveFirst!: (value: string) => void
  const firstResponse = new Promise<string>(resolve => { resolveFirst = resolve })
  let displayed = ''
  const refresh = async (response: Promise<string>) => {
    const version = beginReadingRefresh(versions, readingA)
    const value = await response
    if (versions.get(readingA) === version) displayed = value
  }
  const first = refresh(firstResponse)
  await refresh(Promise.resolve('包含追问1和追问2'))
  resolveFirst('仅有追问1'); await first
  assert.equal(displayed, '包含追问1和追问2')
  const independentB = beginReadingRefresh(versions, readingB)
  assert.equal(independentB, 1); assert.equal(versions.get(readingA), 2)
})

test('back and continue preserve card order, orientations, choices and revealed state', () => {
  const deck = [{ id: 5, isReversed: true }, { id: 0, isReversed: false }, { id: 17, isReversed: true }]
  const selected = [17, 5, 0], revealed = [17, 5]
  assert.equal(previousDrawPhase('reveal', false), 'select')
  assert.equal(previousDrawPhase('select', false), 'question')
  assert.equal(previousDrawPhase('reveal', true), 'question')
  const continued = continueCardSelection(deck, selected, revealed, 3)
  assert.equal(continued.deck, deck); assert.deepEqual(continued.selected, selected); assert.deepEqual(continued.revealed, revealed)
  const fewerCards = continueCardSelection(deck, selected, revealed, 1)
  assert.equal(fewerCards.deck, deck); assert.deepEqual(fewerCards.selected, [17]); assert.deepEqual(fewerCards.revealed, [17])
  assert.deepEqual(continueCardSelection(deck, [99, 5], [99, 5], 3).revealed, [5])
})

test('revealing any chosen card locks the complete draw and back returns to the question', () => {
  const selected = [17, 5, 0], revealed = [5]
  assert.equal(isDrawLocked(null, selected, []), false)
  assert.equal(isDrawLocked(null, selected, [99]), false)
  const locked = isDrawLocked(null, selected, revealed)
  assert.equal(locked, true)
  assert.equal(previousDrawPhase('reveal', false, locked), 'question')
  assert.equal(previousDrawPhase('reveal', false, false), 'select')
  assert.deepEqual(selected, [17, 5, 0]); assert.deepEqual(revealed, [5])
})

test('carried cards and fully revealed single-card draws remain locked', () => {
  assert.equal(isDrawLocked({ id: 17, isReversed: true }, [], []), true)
  assert.equal(isDrawLocked(null, [17], [17]), true)
  assert.equal(previousDrawPhase('reveal', true, true), 'question')
})

test('restoring an older revealed selection cannot reopen the editable deck', () => {
  const draft = { carried: null, selected: [17, 5, 0], revealed: [5], phase: 'select' as const }
  const restored = JSON.parse(JSON.stringify(draft))
  assert.equal(restoredDrawPhase(restored), 'reveal')
  assert.equal(restoredDrawPhase({ ...draft, phase: 'question' }), 'question')
  assert.equal(restoredDrawPhase({ ...draft, revealed: [] }), 'select')
  assert.equal(restoredDrawPhase({ ...draft, carried: { id: 17, isReversed: true }, phase: 'reveal' }), 'question')
})

test('starting an explicit new question clears the lock without mutating the previous draw', () => {
  const previous = { carried: null, selected: [17, 5, 0], revealed: [5], phase: 'question' as const }
  const fresh = blankAskDraft(owner, 'qinghe')
  assert.equal(isDrawLocked(fresh.carried, fresh.selected, fresh.revealed), false)
  assert.equal(restoredDrawPhase(fresh), 'question')
  assert.equal(isDrawLocked(previous.carried, previous.selected, previous.revealed), true)
  assert.deepEqual(previous.selected, [17, 5, 0])
})
