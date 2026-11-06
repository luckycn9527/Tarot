import test from 'node:test'
import assert from 'node:assert/strict'
import { readers as personas } from '../../tarot-server/src/data/readers'
import { readers as catalog } from '../../tarot-server/src/data/readersUi'
import { localizedReader } from '../src/utils/readerLocalization'
import { getMobileReaderGuide, knownMobileReaderGuideIds, mobileReaderGuideCopy } from '../src/mobile/mobileReaderGuide'

test('editorial guides match current catalog and persona IDs in both languages', () => {
  const reviewedCatalog = knownMobileReaderGuideIds.map(id => {
    assert.ok(personas.some(reader => reader.id === id), `${id}: has a real persona source`)
    const reader = catalog.find(reader => reader.id === id)
    assert.ok(reader, `${id}: has a current catalog introduction`)
    return reader
  })
  const examples = new Set<string>()
  for (const reader of reviewedCatalog) {
    for (const english of [false, true]) {
      const localized = english ? localizedReader(reader, 'en-US') : reader
      const guide = getMobileReaderGuide(localized, english)
      assert.equal(guide.kind, 'reviewed', `${reader.id}: current ${english ? 'English' : 'Chinese'} intro is reviewed`)
      if (guide.kind !== 'reviewed') continue
      for (const field of [guide.focus, guide.voice, guide.example]) assert.ok(field.trim().length > 0)
      assert.ok(guide.example.length <= (english ? 350 : 120), 'examples remain short enough to compare on mobile')
      examples.add(guide.example)
    }
  }
  assert.equal(examples.size, knownMobileReaderGuideIds.length * 2, 'each reviewed persona has a distinct illustrative voice')
})

test('focus summaries retain differences grounded in the real personas', () => {
  for (const [id, sourceTerm, focusTerm] of [
    ['qinghe', '五行', '五行'], ['yanxi', '问题的结构', '问题结构'],
    ['mirelle', '情感关系', '情感关系'], ['norick', '决策分析', '决策分析'],
    ['vikram', '呼吸练习', '呼吸'], ['kazuki', '决策树', '决策树'],
  ]) {
    assert.ok(personas.find(reader => reader.id === id)?.systemPrompt.includes(sourceTerm!), `${id}: source supports this focus`)
    const guide = getMobileReaderGuide(catalog.find(reader => reader.id === id)!)
    assert.equal(guide.kind, 'reviewed')
    if (guide.kind === 'reviewed') assert.ok(guide.focus.includes(focusTerm!))
  }
})

test('unknown or changed descriptions use only the current intro without invented traits or samples', () => {
  for (const id of ['new-admin-reader', 'qinghe', '__proto__', 'constructor']) {
    assert.deepEqual(getMobileReaderGuide({ id, desc: '  管理员刚更新的真实简介  ' }), { kind: 'intro', intro: '管理员刚更新的真实简介' })
    assert.deepEqual(getMobileReaderGuide({ id }, true), { kind: 'intro', intro: '' })
  }
})

test('comparison copy identifies AI characters and editorial hypothetical examples in both languages', () => {
  const zh = mobileReaderGuideCopy()
  const en = mobileReaderGuideCopy(true)
  assert.match(zh.aiIdentity, /AI/)
  assert.match(en.aiIdentity, /AI/)
  assert.match(zh.sampleLabel, /示例.*编辑/)
  assert.match(en.sampleLabel, /Illustrative.*example/)
  assert.match(zh.sampleNote, /不是实时解读/)
  assert.match(en.sampleNote, /not a live reading/)
  assert.match(zh.sampleCard, /假设/)
  assert.match(en.sampleCard, /Assumed/)
})
