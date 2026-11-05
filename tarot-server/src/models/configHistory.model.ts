import type { PoolConnection } from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/database.js';
import * as Admin from './admin.model.js';
import { ApiError } from '../utils/apiError.js';
import { canonicalConfig, configDifferences, configHash, CONFIG_SCOPES, type ConfigScope, type ConfigRow, type ConfigMatch } from '../utils/configHistory.js';

type Head = { revision: number; versionId: number | null };
type Action = 'baseline' | 'save' | 'delete' | 'rollback';

export async function snapshot(connection: PoolConnection, scope: ConfigScope): Promise<ConfigRow[]> {
  let rows: ConfigRow[];
  if (scope === 'card-backs') rows = (await Admin.listCardBacks(connection)).map(row => ({
    id: Number(row.id), code: row.code, name: row.name, description: row.description ?? null, assetUrl: row.asset_url ?? null,
    isActive: !!row.is_active, accessType: row.access_type, price: row.price == null ? null : Number(row.price), sortOrder: Number(row.sort_order),
  }));
  else if (scope === 'cards') rows = (await Admin.listTarotCardsConfig(connection)).map(row => ({
    id: Number(row.id), name: row.name, nameEn: row.name_en, uprightKeywords: row.upright_keywords,
    reversedKeywords: row.reversed_keywords, yesNoTendency: row.yes_no_tendency, imageUrl: row.image_url ?? null, isActive: !!row.is_active,
  }));
  else if (scope === 'readers-prompts') rows = (await Admin.listReaderPromptsConfig(connection)).map(row => ({
    readerCode: row.reader_code, displayName: row.display_name ?? null, avatarUrl: row.avatar_url ?? null,
    emoji: row.emoji ?? null, accessLevel: row.access_level ?? null, systemPrompt: row.system_prompt, greeting: row.greeting,
  }));
  else rows = (await Admin.listFeaturedReadersConfig(connection)).map(row => ({
    readerCode: row.reader_code, isActive: !!row.is_active, sortOrder: Number(row.sort_order),
  }));
  return canonicalConfig(scope, rows);
}

async function lockHead(connection: PoolConnection, scope: ConfigScope): Promise<Head> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    'SELECT revision, version_id FROM admin_config_heads WHERE scope = ? FOR UPDATE', [scope]);
  if (!rows[0]) throw new ApiError(503, '配置版本尚未初始化，请稍后重试');
  return { revision: Number(rows[0].revision), versionId: rows[0].version_id == null ? null : Number(rows[0].version_id) };
}

async function insertVersion(connection: PoolConnection, scope: ConfigScope, revision: number, action: Action,
  adminId: number | null, operator: string, reason: string | null, before: ConfigRow[], after: ConfigRow[], targetId: number | null = null) {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO admin_config_versions
     (scope, revision, action, admin_id, operator_name, reason, rollback_target_id, before_snapshot, after_snapshot,
      before_hash, after_hash, change_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [scope, revision, action, adminId, operator, reason, targetId, JSON.stringify(before), JSON.stringify(after),
      configHash(scope, before), configHash(scope, after), configDifferences(scope, before, after).length, new Date()]);
  await connection.execute('UPDATE admin_config_heads SET revision = ?, version_id = ? WHERE scope = ?', [revision, result.insertId, scope]);
  return result.insertId;
}

async function ensureBaseline(connection: PoolConnection, scope: ConfigScope, head: Head, current: ConfigRow[]) {
  if (head.versionId !== null) return;
  head.versionId = await insertVersion(connection, scope, 0, 'baseline', null, 'System', '配置记录启用时的初始自定义配置', current, current);
}

export async function readVersioned<T>(scope: ConfigScope,
  read: (connection: PoolConnection, current: ConfigRow[]) => Promise<T>) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const head = await lockHead(connection, scope);
    const current = await snapshot(connection, scope);
    await ensureBaseline(connection, scope, head, current);
    const data = await read(connection, current);
    await connection.commit();
    return { data, configVersion: { revision: head.revision, hash: configHash(scope, current) } };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function initializeBaselines() {
  for (const scope of CONFIG_SCOPES) await readVersioned(scope, async () => null);
}

export async function changeConfig(scope: ConfigScope, adminId: number, match: ConfigMatch, action: Exclude<Action, 'baseline'>,
  change: (connection: PoolConnection, current: ConfigRow[]) => Promise<void>, targetId: number | null = null) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const head = await lockHead(connection, scope);
    const before = await snapshot(connection, scope);
    await ensureBaseline(connection, scope, head, before);
    const beforeHash = configHash(scope, before);
    if (head.revision !== match.expectedRevision || beforeHash !== match.expectedHash) {
      throw new ApiError(409, '配置已被其他操作更新，请重新加载或重新预览后再提交');
    }
    const [admins] = await connection.execute<RowDataPacket[]>('SELECT display_name, is_active FROM admin_users WHERE id = ?', [adminId]);
    if (!admins[0]?.is_active) throw new ApiError(401, '管理后台登录已失效，请重新登录');
    await change(connection, before);
    const after = await snapshot(connection, scope);
    const afterHash = configHash(scope, after);
    if (beforeHash === afterHash) {
      await connection.commit();
      return { changed: false, versionId: head.versionId, configVersion: { revision: head.revision, hash: afterHash } };
    }
    const revision = head.revision + 1;
    const id = await insertVersion(connection, scope, revision, action, adminId, String(admins[0].display_name).slice(0, 64),
      match.reason?.trim() || null, before, after, targetId);
    await connection.commit();
    return { changed: true, versionId: id, configVersion: { revision, hash: afterHash } };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function cardBackBlockers(connection: PoolConnection, before: ConfigRow[], target: ConfigRow[], lock = false) {
  const targetIds = new Set(target.map(row => Number(row.id)));
  const removed = before.filter(row => !targetIds.has(Number(row.id)));
  if (!removed.length) return [];
  const ids = removed.map(row => Number(row.id));
  const placeholders = ids.map(() => '?').join(',');
  if (lock) {
    // Parent row locks also serialize new purchases against deletion.
    await connection.query(`SELECT id FROM card_backs WHERE id IN (${placeholders}) FOR UPDATE`, ids);
  }
  const [owners] = await connection.query<RowDataPacket[]>(
    `SELECT card_back_id FROM user_card_backs WHERE card_back_id IN (${placeholders})${lock ? ' FOR UPDATE' : ''}`, ids);
  const owned = new Set(owners.map(row => Number(row.card_back_id)));
  return removed.filter(row => owned.has(Number(row.id))).map(row => ({ id: row.id, name: row.name, code: row.code, reason: 'owned-card-back' }));
}

export async function deleteCardBackVersioned(adminId: number, id: number, match: ConfigMatch) {
  return changeConfig('card-backs', adminId, match, 'delete', async (connection, current) => {
    if (!current.some(row => Number(row.id) === id)) throw new ApiError(404, '牌背不存在');
    const target = current.filter(row => Number(row.id) !== id);
    if ((await cardBackBlockers(connection, current, target, true)).length) throw new ApiError(409, '有用户持有此牌背，请改为停用，不能删除');
    await connection.execute('DELETE FROM card_backs WHERE id = ?', [id]);
  });
}

async function removeMissing(connection: PoolConnection, table: string, column: string, values: (string | number | boolean | null)[]) {
  // Table and column names are internal constants, never request values.
  if (values.length) await connection.query(`DELETE FROM ${table} WHERE ${column} NOT IN (${values.map(() => '?').join(',')})`, values);
  else await connection.query(`DELETE FROM ${table}`);
}

async function restoreSnapshot(connection: PoolConnection, scope: ConfigScope, current: ConfigRow[], target: ConfigRow[]) {
  if (configHash(scope, current) === configHash(scope, target)) return;
  if (scope === 'card-backs') {
    if ((await cardBackBlockers(connection, current, target, true)).length) throw new ApiError(409, '回滚会移除用户已持有的牌背，请改为停用或选择其他版本');
    const retainedIds = new Set(target.map(row => row.id));
    for (const row of target) {
      const collision = current.find(existing => (existing.code === row.code && existing.id !== row.id && retainedIds.has(existing.id)) || (existing.id === row.id && existing.code !== row.code));
      if (collision) throw new ApiError(409, '牌背编码或标识已被其他配置占用，不能直接回滚');
    }
    await removeMissing(connection, 'card_backs', 'id', target.map(row => row.id));
    for (const row of target) await connection.execute(
      `INSERT INTO card_backs (id, code, name, description, asset_url, is_active, access_type, price, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description),
       asset_url=VALUES(asset_url), is_active=VALUES(is_active), access_type=VALUES(access_type), price=VALUES(price), sort_order=VALUES(sort_order)`,
      [row.id, row.code, row.name, row.description, row.assetUrl, row.isActive ? 1 : 0, row.accessType, row.price, row.sortOrder]);
  } else if (scope === 'cards') {
    await removeMissing(connection, 'tarot_cards_config', 'id', target.map(row => row.id));
    await Admin.upsertTarotCardsConfig(target as unknown as Parameters<typeof Admin.upsertTarotCardsConfig>[0], connection);
  } else if (scope === 'readers-prompts') {
    await removeMissing(connection, 'reader_prompts_config', 'reader_code', target.map(row => row.readerCode));
    await Admin.upsertReaderPromptsConfig(target as unknown as Parameters<typeof Admin.upsertReaderPromptsConfig>[0], connection);
  } else {
    await removeMissing(connection, 'featured_readers', 'reader_code', target.map(row => row.readerCode));
    await Admin.upsertFeaturedReadersConfig(target as unknown as Parameters<typeof Admin.upsertFeaturedReadersConfig>[0], connection);
  }
}

const META_FIELDS = 'id, scope, revision, action, admin_id AS adminId, operator_name AS operatorName, reason, rollback_target_id AS rollbackTargetId, change_count AS changeCount, created_at AS createdAt';

async function storedVersion(id: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${META_FIELDS}, before_snapshot, after_snapshot FROM admin_config_versions WHERE id = ?`, [id]);
  const row = rows[0];
  if (!row) throw new ApiError(404, '配置版本不存在');
  if (!CONFIG_SCOPES.includes(row.scope)) throw new ApiError(500, '配置版本类型无效');
  const scope = row.scope as ConfigScope;
  const decode = (data: unknown) => canonicalConfig(scope, (typeof data === 'string' ? JSON.parse(data) : data) as ConfigRow[]);
  return { row, scope, before: decode(row.before_snapshot), after: decode(row.after_snapshot) };
}

function metadata(row: RowDataPacket) {
  return { id: Number(row.id), scope: row.scope, revision: Number(row.revision), action: row.action,
    adminId: row.adminId, operatorName: row.operatorName, reason: row.reason, rollbackTargetId: row.rollbackTargetId,
    changeCount: Number(row.changeCount), createdAt: row.createdAt };
}

export async function listConfigHistory(options: { scope?: ConfigScope; page: number; pageSize: number }) {
  const where = options.scope ? 'WHERE scope = ?' : '';
  const args = options.scope ? [options.scope] : [];
  const [counts] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM admin_config_versions ${where}`, args);
  const total = Number(counts[0].total);
  const pageSize = Math.min(50, Math.max(1, Math.trunc(options.pageSize) || 20));
  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(Math.max(1, Math.trunc(options.page) || 1), Math.max(1, totalPages));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${META_FIELDS} FROM admin_config_versions ${where} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, args);
  return { items: rows.map(metadata), total, page, pageSize, totalPages };
}

export async function configVersionDetail(id: number) {
  const version = await storedVersion(id);
  return { ...metadata(version.row), changes: configDifferences(version.scope, version.before, version.after) };
}

export async function previewConfigRollback(id: number) {
  const target = await storedVersion(id);
  const result = await readVersioned(target.scope, async (connection, current) => ({
    target: metadata(target.row), changes: configDifferences(target.scope, current, target.after),
    blockers: target.scope === 'card-backs' ? await cardBackBlockers(connection, current, target.after) : [],
  }));
  return { ...result.data, configVersion: result.configVersion };
}

export async function rollbackConfig(id: number, adminId: number, match: ConfigMatch) {
  const target = await storedVersion(id);
  return changeConfig(target.scope, adminId, match, 'rollback',
    (connection, current) => restoreSnapshot(connection, target.scope, current, target.after), id);
}
