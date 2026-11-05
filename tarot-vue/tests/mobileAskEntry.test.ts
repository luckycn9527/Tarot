import test from 'node:test'
import assert from 'node:assert/strict'
import { askDraftKey, blankAskDraft, hasAskDraftProgress, mergeSavedAskDrafts, validSavedAskDrafts } from '../src/mobile/mobileAskEntry'
import type { MobileDraft, PendingMobileTask } from '../src/mobile/types'

const owner = 71
function draft(overrides: Partial<MobileDraft> = {}): MobileDraft {
  return {
    schema: 1, owner, question: '我可以如何规划下一步？', count: 3, readerId: 'qinghe', carried: null,
    deck: [{ id: 17, isReversed: true }, { id: 0, isReversed: false }, { id: 6, isReversed: true }],
    selected: [17, 0, 6], revealed: [17], phase: 'reveal', savedAt: Date.now(), ...overrides,
  }
}

test('only a real question or draw can be resumed; preferences and saved results are excluded', () => {
  const blank = blankAskDraft(owner, 'qinghe')
  assert.equal(hasAskDraftProgress(blank), false)
  assert.equal(hasAskDraftProgress({ ...blank, question: '  ', readerId: 'another', count: 3 }), false)
  assert.equal(hasAskDraftProgress({ ...blank, deck: draft().deck }), false)
  assert.equal(hasAskDraftProgress({ ...blank, question: '想' }), true)
  assert.equal(hasAskDraftProgress({ ...blank, carried: { id: 0, isReversed: true } }), true)
  assert.equal(hasAskDraftProgress({ ...blank, phase: 'select', deck: draft().deck }), true)
  assert.equal(hasAskDraftProgress({ ...blank, phase: 'reveal', deck: draft().deck }), true)
  assert.equal(hasAskDraftProgress({ ...draft(), phase: 'result', readingId: 88 }), false)
})

test('valid drafts are all retained and ordered newest first without truncation', () => {
  const now = Date.now()
  const drafts = Array.from({ length: 150 }, (_, index) => draft({ question: `第 ${index} 个未完成的问题`, savedAt: now - index }))
  const saved = validSavedAskDrafts([...drafts].reverse(), owner)
  assert.equal(saved.length, 150)
  assert.deepEqual(saved.map(row => row.question), drafts.map(row => row.question))
})

test('saved drafts reuse owner, expiration and original card validation', () => {
  const valid = draft()
  const values: unknown[] = [
    valid, null, {}, { ...valid, owner: owner + 1 }, { ...valid, owner: null },
    { ...valid, savedAt: Date.now() - 8 * 86400000 },
    { ...valid, deck: [{ id: 17, isReversed: 'reversed' }] },
    { ...valid, selected: [17, 17] }, { ...valid, revealed: [2] },
    { ...valid, phase: 'result', readingId: 88 }, blankAskDraft(owner, 'qinghe'),
  ]
  assert.deepEqual(validSavedAskDrafts(values, owner), [valid])
  assert.equal(validSavedAskDrafts(values, owner + 1).length, 1)
  assert.equal(validSavedAskDrafts(values, null).length, 1)
  assert.deepEqual(validSavedAskDrafts({ drafts: [valid] }, owner), [])
})

test('merging deduplicates identical content using the newest timestamp without mutating inputs', () => {
  const old = draft({ savedAt: Date.now() - 1000 })
  const latest = draft({ savedAt: old.savedAt + 500 })
  const another = draft({ question: '下一件事应该关注什么？', savedAt: old.savedAt + 250 })
  const existing = Object.freeze([Object.freeze(old)])
  const incoming = Object.freeze([Object.freeze(latest), Object.freeze(another)])
  const snapshot = JSON.stringify({ existing, incoming })
  const result = mergeSavedAskDrafts(existing, [...incoming], owner)
  assert.equal(JSON.stringify({ existing, incoming }), snapshot)
  assert.deepEqual(result, [latest, another])
  assert.equal(validSavedAskDrafts([latest, old], owner)[0]?.savedAt, latest.savedAt)
  assert.equal(mergeSavedAskDrafts(existing, [draft({ owner: owner + 1 })], owner).length, 1)
})

test('different question, reader, count, phase, draw order or orientation remain independent drafts', () => {
  const base = draft()
  const variants = [
    base,
    draft({ question: '我现在应该先做哪一件事？' }),
    draft({ readerId: 'another' }),
    draft({ phase: 'select' }),
    draft({ count: 1, selected: [17] }),
    draft({ deck: [...base.deck].reverse() }),
    draft({ deck: base.deck.map(card => ({ ...card, isReversed: !card.isReversed })) }),
    draft({ selected: [0, 17, 6] }),
    draft({ revealed: [17, 0] }),
  ]
  assert.equal(validSavedAskDrafts(variants, owner).length, variants.length)
  const restored = validSavedAskDrafts([base], owner)[0]!
  assert.deepEqual(restored.deck, base.deck)
  assert.deepEqual(restored.selected, [17, 0, 6])
  assert.deepEqual(restored.revealed, [17])
})

test('restored snapshots and carried cards share no mutable cards or arrays with their sources', () => {
  const original = draft()
  const carried = draft({ count: 1, carried: { id: 22, isReversed: true }, deck: [], selected: [], revealed: [22] })
  const saved = validSavedAskDrafts([original, carried], owner)
  const restored = saved.find(row => !row.carried)!
  const restoredCarried = saved.find(row => row.carried)!
  assert.notEqual(restored.deck, original.deck)
  assert.notEqual(restored.deck[0], original.deck[0])
  assert.notEqual(restored.selected, original.selected)
  assert.notEqual(restored.revealed, original.revealed)
  assert.notEqual(restoredCarried.carried, carried.carried)
  restored.deck[0]!.isReversed = false
  restored.selected.reverse()
  restored.revealed.push(0)
  restoredCarried.carried!.isReversed = false
  assert.equal(original.deck[0]!.isReversed, true)
  assert.deepEqual(original.selected, [17, 0, 6])
  assert.deepEqual(original.revealed, [17])
  assert.equal(carried.carried!.isReversed, true)
})

test('rendering keys are stable across saves without including private question text', () => {
  const original = draft()
  assert.equal(askDraftKey(original), askDraftKey({ ...original, savedAt: original.savedAt + 100 }))
  assert.match(askDraftKey(original), /^draft-[a-f0-9]{16}$/)
  assert.notEqual(askDraftKey(original), askDraftKey({ ...original, owner: owner + 1 }))
  assert.notEqual(askDraftKey(original), askDraftKey({ ...original, deck: [...original.deck].reverse() }))
  assert.notEqual(askDraftKey(original), askDraftKey({ ...original, phase: 'select' }))
})

test('a fresh question has no old result or cards and leaves a pending request intact', () => {
  const original = draft()
  const pending: PendingMobileTask = {
    schema: 1, owner, requestId: 'a319d6e2-c61b-46c7-9d75-59958950d448', kind: 'reading', createdAt: Date.now(),
    payload: { readerId: original.readerId, spreadType: 'problem', question: original.question, category: '其他',
      cardIds: original.selected, orientations: ['reversed', 'upright', 'reversed'], locale: 'zh-CN' },
  }
  const snapshot = JSON.stringify(pending)
  const fresh = blankAskDraft(owner, 'another', 123)
  assert.deepEqual(fresh, {
    schema: 1, owner, readerId: 'another', question: '', count: 1, carried: null,
    deck: [], selected: [], revealed: [], phase: 'question', savedAt: 123,
  })
  assert.equal(Object.hasOwn(fresh, 'readingId'), false)
  assert.equal(mergeSavedAskDrafts([original], [fresh], owner).length, 1)
  assert.equal(JSON.stringify(pending), snapshot)
  assert.equal(blankAskDraft(null, 'guest').owner, null)
})
