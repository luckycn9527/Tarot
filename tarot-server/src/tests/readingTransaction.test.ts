import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolConnection } from 'mysql2/promise';

process.env.NODE_ENV = 'test';
process.env.DB_PASSWORD = 'inert-transaction-fixture';
const [{ pool }, Reading] = await Promise.all([import('../config/database.js'), import('../models/reading.model.js')]);

test('cold reference lookup and history persistence use the caller transaction without another pool connection', async () => {
  const original = { execute: pool.execute, getConnection: pool.getConnection };
  const calls: string[] = [];
  pool.execute = (() => { throw new Error('A caller transaction must not acquire a second database resource'); }) as typeof pool.execute;
  pool.getConnection = (() => { throw new Error('A caller transaction must not open another connection'); }) as typeof pool.getConnection;
  const connection = {
    execute: async (sql: string) => {
      calls.push(sql);
      if (sql.includes('SELECT id, code FROM reference_tarot_readers')) return [[{ id: 3, code: 'qinghe' }], []];
      if (sql.includes('SELECT id, code FROM reference_spreads')) return [[{ id: 4, code: 'single' }], []];
      return [{ insertId: 17, affectedRows: 1 }, []];
    },
    beginTransaction: () => { throw new Error('Only the caller begins the transaction'); },
    commit: () => { throw new Error('Only the caller may commit'); },
    rollback: () => { throw new Error('Only the caller may roll back'); },
    release: () => { throw new Error('Only the caller may release'); },
  } as unknown as PoolConnection;
  try {
    const id = await Reading.create({ userId: 8, type: 'reader-reading', question: 'Fixture question', cardIds: [0],
      orientations: ['upright'], answer: null, resultData: {}, readerId: 'qinghe', spreadType: 'single' }, connection);
    assert.equal(id, 17);
    assert.equal(calls.length, 4);
    assert.ok(calls.some(sql => sql.includes('reading_history_cards')));
    assert.ok(await Reading.appendFollowupTurn(17, 8, { question: 'Next?', answer: 'Fixture', requestId: 'fixture-request' }, connection));
  } finally { Object.assign(pool, original); await pool.end(); }
});
