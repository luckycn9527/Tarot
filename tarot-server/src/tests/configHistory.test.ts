import assert from 'node:assert/strict';
import test from 'node:test';
import { configDifferences, configHash, canonicalConfig, type ConfigRow } from '../utils/configHistory.js';
import { putCardsSchema, putReaderPromptsSchema, rollbackConfigSchema } from '../validation/adminConfig.js';
import { invalidatableCache } from '../utils/invalidatableCache.js';
import { configuredCards } from '../utils/configuredCards.js';

test('configuration fingerprints ignore row order and unrelated fields but keep falsy values', () => {
  const rows: ConfigRow[] = [{ readerCode: 'a', isActive: false, sortOrder: 0 }, { readerCode: 'b', isActive: true, sortOrder: 2 }];
  assert.equal(configHash('featured-readers', rows), configHash('featured-readers', [...rows].reverse()));
  assert.equal(configHash('featured-readers', rows), configHash('featured-readers', rows.map(row => ({ ...row, secret: 'not a config field' }))));
  assert.notEqual(configHash('featured-readers', rows), configHash('featured-readers', [{ ...rows[0], isActive: true }, rows[1]]));
  assert.equal(canonicalConfig('featured-readers', rows)[0].sortOrder, 0);
});

test('configuration diffs preserve added, removed and changed fields, including full prompt text', () => {
  const before: ConfigRow[] = [{ readerCode: 'a', systemPrompt: 'Old\n' + 'A'.repeat(5000), greeting: 'Hello' }, { readerCode: 'b', greeting: 'Bye' }];
  const after: ConfigRow[] = [{ readerCode: 'a', systemPrompt: 'New\n' + 'B'.repeat(5000), greeting: 'Hello' }, { readerCode: 'c', greeting: 'New' }];
  const diff = configDifferences('readers-prompts', before, after);
  assert.deepEqual(diff.map(row => row.operation), ['updated', 'removed', 'added']);
  assert.equal(diff[0].fields[0].field, 'systemPrompt');
  assert.equal(diff[0].fields[0].after, after[0].systemPrompt);
  assert.equal(configDifferences('readers-prompts', before, before).length, 0);
});

test('configuration writes require a loaded revision and rollback explanation', () => {
  const card = { id: 0, name: '愚者', nameEn: 'The Fool', uprightKeywords: '', reversedKeywords: '', yesNoTendency: 'neutral', isActive: true };
  assert.equal(putCardsSchema.safeParse({ items: [card] }).success, false);
  const match = { expectedRevision: 0, expectedHash: '0'.repeat(64) };
  assert.equal(putCardsSchema.safeParse({ ...match, items: [card] }).success, true);
  assert.equal(putCardsSchema.safeParse({ ...match, items: [card, card] }).success, false);
  assert.equal(rollbackConfigSchema.safeParse({ ...match, reason: ' ' }).success, false);
  assert.equal(rollbackConfigSchema.safeParse({ ...match, reason: 'Restore confirmed settings' }).success, true);
  assert.equal(putReaderPromptsSchema.safeParse({ ...match, items: [
    { readerCode: 'qinghe', systemPrompt: 'a', greeting: 'b' }, { readerCode: 'qinghe', systemPrompt: 'c', greeting: 'd' },
  ] }).success, false);
});

test('editing one card retains other built-in cards and disabling is explicit', () => {
  assert.equal(configuredCards([]).length, 78);
  const cards = configuredCards([{ id: 0, name: 'Custom Fool', name_en: 'Custom Fool', upright_keywords: '', reversed_keywords: '', yes_no_tendency: 'neutral', image_url: null, is_active: 1 }]);
  assert.equal(cards.length, 78);
  assert.equal(cards[0].name, 'Custom Fool');
  assert.notEqual(cards[1].name, 'Custom Fool');
  assert.equal(configuredCards([{ id: 0, name: 'Fool', name_en: 'Fool', upright_keywords: '', reversed_keywords: '', yes_no_tendency: 'neutral', image_url: null, is_active: 0 }]).filter(card => card.isActive).length, 77);
});

test('an in-flight old reference load cannot replace the cache after rollback invalidates it', async () => {
  const pending: ((value: string) => void)[] = [];
  const cache = invalidatableCache(() => new Promise<string>(resolve => pending.push(resolve)), 60000);
  const old = cache.get();
  cache.invalidate();
  const current = cache.get();
  pending[1]('restored');
  assert.equal(await current, 'restored');
  pending[0]('old');
  assert.equal(await old, 'old');
  assert.equal(await cache.get(), 'restored');
  assert.equal(pending.length, 2);
});
