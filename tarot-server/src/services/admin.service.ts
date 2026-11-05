import type { PoolConnection } from 'mysql2/promise';
import * as ConfigHistory from '../models/configHistory.model.js';
import type { ConfigMatch } from '../utils/configHistory.js';
import { ApiError } from '../utils/apiError.js';
import { configuredCards } from '../utils/configuredCards.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import * as AdminModel from '../models/admin.model.js';
import type { AdminReaderPrompt } from '../models/admin.model.js';
import { readers as staticReaders } from '../data/readers.js';
import { hashAdminUsername, signAdminToken } from '../utils/adminAuth.js';
import { getDefaultReaderAvatarUrl } from '../utils/defaultReaderAvatars.js';
import { resolveReaderAvatarThumbUrl } from '../utils/readerAvatarThumb.js';
import { fail } from '../utils/response.js';
import * as UserQuestionsModel from '../models/adminUserQuestions.model.js';
import type { AdminListUsersQuery, AdminUserQuestionsQuery } from '../validation/adminQuery.js';

/** 管理后台「塔罗师设置」列表：camelCase，且始终带上代码里的默认提示词/名称供展示与编辑 */
export interface AdminReaderPromptListItem {
  readerCode: string;
  displayName: string | null;
  avatarUrl: string | null;
  emoji: string | null;
  accessLevel: 'free' | 'vip' | null;
  systemPrompt: string;
  greeting: string;
  defaultDisplayName: string;
  defaultEmoji: string;
  id: number | null;
  updatedAt: string | null;
  avatarThumbUrl: string | null;
  effectiveAvatarUrl: string | null;
  effectiveAvatarThumbUrl: string | null;
}

function effectivePromptText(
  db: AdminReaderPrompt | undefined,
  field: 'system_prompt' | 'greeting',
  fallback: string,
): string {
  const raw = db?.[field];
  if (raw == null) return fallback;
  const s = String(raw);
  return s.trim().length > 0 ? s : fallback;
}

function adminLoginFail() {
  throw new Error(fail('管理员账号或密码错误').message);
}

export async function adminLogin(username: string, password: string) {
  const usernameHash = hashAdminUsername(username);
  const admin = await AdminModel.findAdminByUsernameHash(usernameHash);
  if (!admin || !admin.is_active) {
    adminLoginFail();
  }
  const safeAdmin = admin as NonNullable<typeof admin>;
  const ok = await bcrypt.compare(password, safeAdmin.password_hash);
  if (!ok) {
    adminLoginFail();
  }
  await AdminModel.touchAdminLastLogin(safeAdmin.id);
  const accessToken = signAdminToken({ adminId: safeAdmin.id });
  return {
    accessToken,
    admin: {
      id: safeAdmin.id,
      displayName: safeAdmin.display_name,
    },
  };
}

export async function listUsers(page: number, pageSize: number, keyword?: string, sort?: AdminListUsersQuery['sort']) {
  return AdminModel.listUsers({ page, pageSize, keyword, sort });
}

export async function listUserQuestions(userId: number, query: AdminUserQuestionsQuery) {
  return UserQuestionsModel.listUserQuestions(userId, query);
}

export async function updateUserByAdmin(userId: number, patch: any) {
  await AdminModel.updateUserByAdmin(userId, patch);
}

function generatedInvitationCode(): string {
  return `ETOMD-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

export async function listInvitationCodes() {
  return AdminModel.listInvitationCodes();
}

export async function createInvitationCode(input: {
  code?: string;
  type: 'quota' | 'vip_days';
  value: number;
  maxUses: number;
  expiresAt: string | null;
}) {
  const requestedCode = input.code?.trim().toUpperCase();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error('邀请码到期时间无效');
  }
  const attempts = requestedCode ? 1 : 3;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = requestedCode || generatedInvitationCode();
    try {
      const id = await AdminModel.createInvitationCode({ ...input, code, expiresAt });
      return { id, code };
    } catch (error) {
      if (!isDuplicateEntry(error)) throw error;
      if (requestedCode) throw new Error('邀请码已存在');
    }
  }
  throw new Error('邀请码生成冲突，请重试');
}

export async function setInvitationCodeActive(id: number, isActive: boolean) {
  const updated = await AdminModel.setInvitationCodeActive(id, isActive);
  if (!updated) throw new Error('邀请码不存在');
}

export async function listCardBacks(connection?: PoolConnection) {
  return AdminModel.listCardBacks(connection);
}

export async function saveCardBacks(items: Array<{
  code: string;
  name: string;
  description: string | null;
  assetUrl: string | null;
  isActive: boolean;
  accessType: 'free' | 'vip' | 'paid';
  price: number | null;
  sortOrder: number;
}>, adminId: number, match: ConfigMatch) {
  return ConfigHistory.changeConfig('card-backs', adminId, match, 'save', async (connection, current) => {
    for (const item of items as (typeof items[number] & { id?: number })[]) {
      if (item.id && !current.some(row => row.id === item.id && row.code === item.code)) throw new ApiError(409, '已有牌背编码不可修改，请重新加载或新增牌背');
    }
    await AdminModel.upsertCardBacks(items, connection);
  });
}

export async function deleteCardBack(id: number, adminId: number, match: ConfigMatch) {
  return ConfigHistory.deleteCardBackVersioned(adminId, id, match);
}

export async function listCards(connection?: PoolConnection) {
  return configuredCards(await AdminModel.listTarotCardsConfig(connection)).map(card => ({ id: card.id, name: card.name,
    name_en: card.nameEn, upright_keywords: card.uprightKeywords, reversed_keywords: card.reversedKeywords,
    yes_no_tendency: card.yesNoTendency, image_url: card.imageUrl, is_active: card.isActive ? 1 : 0 }));
}

export async function saveCards(items: Array<{
  id: number;
  name: string;
  nameEn: string;
  uprightKeywords: string;
  reversedKeywords: string;
  yesNoTendency: 'yes' | 'no' | 'neutral';
  imageUrl: string | null;
  isActive: boolean;
}>, adminId: number, match: ConfigMatch) {
  return ConfigHistory.changeConfig('cards', adminId, match, 'save', async connection => {
    await AdminModel.upsertTarotCardsConfig(items, connection);
  });
}

export async function listReaderPrompts(connection?: PoolConnection): Promise<AdminReaderPromptListItem[]> {
  const dbRows = await AdminModel.listReaderPromptsConfig(connection);
  const byCode = new Map(dbRows.map((r) => [r.reader_code, r]));
  return staticReaders.map((sr) => {
    const db = byCode.get(sr.id);
    const dn = db?.display_name != null ? String(db.display_name).trim() : '';
    const avatarUrl =
      db?.avatar_url != null && String(db.avatar_url).trim() !== '' ? String(db.avatar_url) : null;
    const effectiveAvatarUrl = avatarUrl || getDefaultReaderAvatarUrl(sr.id);
    return {
      readerCode: sr.id,
      displayName: dn.length > 0 ? dn : null,
      avatarUrl,
      avatarThumbUrl: resolveReaderAvatarThumbUrl(avatarUrl),
      effectiveAvatarUrl,
      effectiveAvatarThumbUrl: resolveReaderAvatarThumbUrl(effectiveAvatarUrl),
      emoji: db?.emoji != null && String(db.emoji).trim() !== '' ? String(db.emoji) : null,
      accessLevel: db?.access_level ?? null,
      systemPrompt: effectivePromptText(db, 'system_prompt', sr.systemPrompt),
      greeting: effectivePromptText(db, 'greeting', sr.greeting),
      defaultDisplayName: sr.name,
      defaultEmoji: sr.emoji,
      id: db?.id != null ? Number(db.id) : null,
      updatedAt: db?.updated_at != null ? String(db.updated_at) : null,
    };
  });
}

export async function saveReaderPrompts(items: Array<{
  readerCode: string;
  displayName: string | null;
  avatarUrl: string | null;
  emoji: string | null;
  accessLevel: 'free' | 'vip' | null;
  systemPrompt: string;
  greeting: string;
}>, adminId: number, match: ConfigMatch) {
  return ConfigHistory.changeConfig('readers-prompts', adminId, match, 'save', async connection => {
    if (items.some(item => !staticReaders.some(reader => reader.id === item.readerCode))) throw new ApiError(400, '塔罗师编码无效');
    await AdminModel.upsertReaderPromptsConfig(items, connection);
  });
}

export async function getReaderPromptOverride(readerCode: string) {
  return AdminModel.findReaderPromptByCode(readerCode);
}

export interface AdminFeaturedReaderListItem {
  readerCode: string;
  isActive: boolean;
  sortOrder: number;
}

export async function listFeaturedReaders(connection?: PoolConnection): Promise<AdminFeaturedReaderListItem[]> {
  const dbRows = await AdminModel.listFeaturedReadersConfig(connection);
  const byCode = new Map(dbRows.map((r) => [r.reader_code, r]));
  return staticReaders.map((sr) => {
    const db = byCode.get(sr.id);
    return {
      readerCode: sr.id,
      isActive: db?.is_active === 1,
      sortOrder: db?.sort_order ?? 0,
    };
  });
}

export async function saveFeaturedReaders(items: AdminFeaturedReaderListItem[], adminId: number, match: ConfigMatch) {
  const validCodes = new Set(staticReaders.map((r) => r.id));
  const filtered = items.filter((item) => validCodes.has(item.readerCode));
  if (filtered.length !== items.length) throw new ApiError(400, '推荐塔罗师编码无效');
  return ConfigHistory.changeConfig('featured-readers', adminId, match, 'save', connection => AdminModel.upsertFeaturedReadersConfig(filtered, connection));
}

export async function getStats() {
  return AdminModel.getStats();
}

export async function listFeedback(page: number, pageSize: number, status?: string) {
  return AdminModel.listFeedback({ page, pageSize, status });
}

export async function replyFeedback(id: number, adminReply: string, status: string) {
  await AdminModel.replyFeedback(id, adminReply, status);
}
