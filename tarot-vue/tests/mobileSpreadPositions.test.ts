import test from 'node:test'
import assert from 'node:assert/strict'
import { localizedSpreadPositions } from '../src/utils/readerLocalization'

test('mobile problem spread uses configured position order for Chinese and its matching English translation', () => {
  const spread = { id: 'problem', positions: ['问题的起因', '问题的现状', '问题解决方法'] }
  assert.deepEqual(localizedSpreadPositions(spread, 'zh-CN'), spread.positions)
  assert.deepEqual(localizedSpreadPositions(spread, 'en-US'), ['Root cause', 'Current situation', 'Way forward'])
  const configured = { id: 'problem', positions: ['自定义起因', '自定义现状', '自定义解法'] }
  assert.deepEqual(localizedSpreadPositions(configured, 'zh-CN'), configured.positions)
})

test('untranslated spread positions retain their configured meaning', () => {
  const spread = { id: 'custom-reader-spread', positions: ['First configured position', 'Second configured position'] }
  assert.deepEqual(localizedSpreadPositions(spread, 'en-US'), spread.positions)
})
