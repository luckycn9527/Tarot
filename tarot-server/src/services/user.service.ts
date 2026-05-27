import bcrypt from 'bcryptjs';
import * as UserModel from '../models/user.model.js';
import * as SettingsModel from '../models/settings.model.js';
import { toPublicUser } from './auth.service.js';
import { getZodiacFromDate } from '../utils/zodiac.js';
import { cacheGet, cacheSet, cacheDel, CACHE_KEYS } from './cacheRedis.service.js';

const SETTINGS_CACHE_TTL_SEC = 600;

export async function getProfile(userId: number) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');

  // Auto reset quota if needed
  const today = new Date().toISOString().slice(0, 10);
  if (user.quota_reset_date !== today) {
    await UserModel.updateProfile(userId, {} as any);
    // Reset quota in response
    const { pool } = await import('../config/database.js');
    await pool.execute(
      'UPDATE users SET remaining_free_quota = 3, quota_reset_date = ? WHERE id = ?',
      [today, userId]
    );
    user.remaining_free_quota = 3;
  }

  return toPublicUser(user);
}

export async function updateProfile(userId: number, data: {
  nickname?: string;
  avatar?: string;
  gender?: string;
  birthday?: string | null;
  location?: string | null;
  bio?: string | null;
}) {
  const updateData: any = { ...data };

  // Auto-compute zodiac from birthday
  if (data.birthday) {
    updateData.zodiac_sign = getZodiacFromDate(data.birthday);
  } else if (data.birthday === null) {
    updateData.zodiac_sign = null;
  }

  await UserModel.updateProfile(userId, updateData);
  return getProfile(userId);
}

export async function changePassword(userId: number, oldPassword: string, newPassword: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');

  if (!user.password_hash) {
    const hash = await bcrypt.hash(newPassword, 10);
    await UserModel.updatePassword(userId, hash);
    return;
  }

  const valid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!valid) throw new Error('原密码错误');

  const hash = await bcrypt.hash(newPassword, 10);
  await UserModel.updatePassword(userId, hash);
}

export async function getQuota(userId: number) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');

  const today = new Date().toISOString().slice(0, 10);
  let remaining = user.remaining_free_quota;

  if (user.quota_reset_date !== today) {
    const { pool } = await import('../config/database.js');
    await pool.execute(
      'UPDATE users SET remaining_free_quota = 3, quota_reset_date = ? WHERE id = ?',
      [today, userId]
    );
    remaining = 3;
  }

  const isVip = user.membership === 'vip' &&
    user.membership_expires_at &&
    new Date(user.membership_expires_at) > new Date();

  return {
    remaining,
    total: 3,
    isVip,
    membership: user.membership,
    membershipExpiresAt: user.membership_expires_at,
  };
}

export async function getSettings(userId: number) {
  const key = CACHE_KEYS.userSettings(userId);
  const cached = await cacheGet<Awaited<ReturnType<typeof SettingsModel.getSettings>>>(key);
  if (cached) return cached;
  const data = await SettingsModel.getSettings(userId);
  await cacheSet(key, data, SETTINGS_CACHE_TTL_SEC);
  return data;
}

export async function updateSettings(
  userId: number,
  cardBackCode?: string,
  settings?: object,
) {
  let cardBackId: number | null | undefined;
  if (cardBackCode !== undefined && cardBackCode !== '') {
    const id = await SettingsModel.resolveCardBackId(cardBackCode);
    if (id === null) {
      throw new Error('无效的牌背代码');
    }
    cardBackId = id;
  }
  await SettingsModel.upsertSettings(userId, cardBackId, settings);
  await cacheDel(CACHE_KEYS.userSettings(userId));
  return getSettings(userId);
}

export async function getBirthInfo(userId: number) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');
  return {
    birthday: user.birthday,
    zodiacSign: user.zodiac_sign,
  };
}

export async function updateBirthInfo(
  userId: number,
  birthday: string | null,
) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');

  if (birthday !== null) {
    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      throw Object.assign(new Error('日期格式无效，请使用 YYYY-MM-DD'), { status: 400 });
    }

    // Parse and validate calendar date
    const [yearStr, monthStr, dayStr] = birthday.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    // Check month/day ranges before Date construction
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw Object.assign(new Error('日期不是合法的日历日期'), { status: 400 });
    }

    // Use Date to verify the date is a real calendar date
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      throw Object.assign(new Error('日期不是合法的日历日期'), { status: 400 });
    }

    // Check not in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsed.getTime() > today.getTime()) {
      throw Object.assign(new Error('出生日期不能晚于今天'), { status: 400 });
    }
  }

  const zodiacSign = birthday ? getZodiacFromDate(birthday) : null;

  await UserModel.updateProfile(userId, {
    birthday,
    zodiac_sign: zodiacSign,
  });

  return { birthday, zodiacSign };
}

export async function activateVip(userId: number, days: number) {
  const { pool } = await import('../config/database.js');
  await pool.execute(
    `UPDATE users SET
      membership = 'vip',
      membership_expires_at = GREATEST(COALESCE(membership_expires_at, NOW()), NOW()) + INTERVAL ? DAY
     WHERE id = ?`,
    [days, userId]
  );
  return getProfile(userId);
}
