import assert from 'node:assert/strict'
import test from 'node:test'
import { nicknameInputError } from '../src/mobile/mobileProfile'

test('nickname input trims surrounding whitespace and accepts the server length bounds', () => {
  assert.equal(nicknameInputError('  星语  '), '')
  assert.equal(nicknameInputError('名'.repeat(20)), '')
  assert.equal(nicknameInputError('Name with spaces'), '')
  assert.ok(nicknameInputError('  '))
  assert.ok(nicknameInputError(' a '))
  assert.ok(nicknameInputError('名'.repeat(21)))
})

test('nickname length follows UTF-16 string length used by the server schema', () => {
  assert.equal(nicknameInputError('🌙'.repeat(10)), '')
  assert.ok(nicknameInputError('🌙'.repeat(11)))
  assert.match(nicknameInputError('a', true), /2–20/)
})
