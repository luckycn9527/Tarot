import bcrypt from 'bcryptjs';
import * as AdminModel from '../models/admin.model.js';
import type { AdminReaderPrompt } from '../models/admin.model.js';
import { readers as staticReaders } from '../data/readers.js';
import { hashAdminUsername, signAdminToken } from '../utils/adminAuth.js';
import { resolveReaderAvatarThumbUrl } from '../utils/readerAvatarThumb.js';
import { fail } from '../utils/response.js';

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

export async function listUsers(page: number, pageSize: number, keyword?: string) {
  return AdminModel.listUsers({ page, pageSize, keyword });
}

export async function updateUserByAdmin(userId: number, patch: any) {
  await AdminModel.updateUserByAdmin(userId, patch);
}

export async function listCardBacks() {
  return AdminModel.listCardBacks();
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
}>) {
  await AdminModel.upsertCardBacks(items);
}

export async function deleteCardBack(id: number) {
  await AdminModel.deleteCardBack(id);
}

export async function listCards() {
  return AdminModel.listTarotCardsConfig();
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
}>) {
  await AdminModel.upsertTarotCardsConfig(items);
}

export async function listReaderPrompts(): Promise<AdminReaderPromptListItem[]> {
  const dbRows = await AdminModel.listReaderPromptsConfig();
  const byCode = new Map(dbRows.map((r) => [r.reader_code, r]));
  return staticReaders.map((sr) => {
    const db = byCode.get(sr.id);
    const dn = db?.display_name != null ? String(db.display_name).trim() : '';
    const avatarUrl =
      db?.avatar_url != null && String(db.avatar_url).trim() !== '' ? String(db.avatar_url) : null;
    return {
      readerCode: sr.id,
      displayName: dn.length > 0 ? dn : null,
      avatarUrl,
      avatarThumbUrl: resolveReaderAvatarThumbUrl(avatarUrl),
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
}>) {
  await AdminModel.upsertReaderPromptsConfig(items);
}

export async function getReaderPromptOverride(readerCode: string) {
  return AdminModel.findReaderPromptByCode(readerCode);
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
