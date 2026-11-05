import bcrypt from 'bcryptjs';
import * as UserModel from '../models/user.model.js';
import * as SettingsModel from '../models/settings.model.js';
import { toPublicUser } from './auth.service.js';
import { getZodiacFromDate } from '../utils/zodiac.js';
import { toDateOnly } from '../utils/dateOnly.js';
import { assertBirthday, assertBirthTime, toBirthTime } from '../utils/birthInfo.js';
import { cacheGet, cacheSet, cacheDel, CACHE_KEYS } from './cacheRedis.service.js';
import { isActiveVip } from '../utils/membership.js';
import { env } from '../config/env.js';
import { quotaWindow } from '../utils/quotaDate.js';

const SETTINGS_CACHE_TTL_SEC = 600;

export async function getProfile(userId: number) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');

  // 若每日配额已过期，自动重置为 3 次
  await UserModel.resetQuotaIfNeeded(userId);
  // 重新读取以确保返回最新配额
  const refreshed = await UserModel.findById(userId);
  if (!refreshed) throw new Error('用户不存在');

  return toPublicUser(refreshed);
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

  if (data.birthday !== undefined) assertBirthday(data.birthday);

  // Auto-compute zodiac from birthday
  if (data.birthday) {
    updateData.zodiac_sign = getZodiacFromDate(data.birthday);
  } else if (data.birthday === null) {
    updateData.zodiac_sign = null;
    updateData.birth_time = null;
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

export async function deleteAccount(userId: number, password: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');
  if (!user.password_hash) {
    throw new Error('请先在个人中心设置密码后再注销账号');
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('当前密码不正确');

  await UserModel.deleteUserAndData(userId);
  return { avatar: user.avatar };
}

export async function getQuota(userId: number) {
  const window = quotaWindow(env.QUOTA_TIME_ZONE);
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');

  await UserModel.resetQuotaIfNeeded(userId, window.businessDate);
  const refreshed = await UserModel.findById(userId);
  if (!refreshed) throw new Error('用户不存在');

  const remaining = refreshed.remaining_free_quota;

  const isVip = isActiveVip(refreshed);

  return {
    ...window,
    remaining,
    total: UserModel.DAILY_FREE_QUOTA,
    dailyFortuneRemaining: refreshed.remaining_daily_fortune_quota,
    dailyFortuneTotal: UserModel.DAILY_FORTUNE_FREE_QUOTA,
    fateDualRemaining: refreshed.remaining_fate_dual_quota,
    fateDualTotal: UserModel.DAILY_FATE_DUAL_FREE_QUOTA,
    isVip,
    unlimited: Boolean(isVip),
    membership: refreshed.membership,
    membershipExpiresAt: refreshed.membership_expires_at,
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
    birthday: toDateOnly(user.birthday),
    birthTime: user.birthday ? toBirthTime(user.birth_time) : null,
    zodiacSign: user.zodiac_sign,
  };
}

export async function updateBirthInfo(
  userId: number,
  birthday: string | null,
  birthTime?: string | null,
) {
  const user = await UserModel.findById(userId);
  if (!user) throw new Error('用户不存在');

  assertBirthday(birthday);
  assertBirthTime(birthTime);
  if (birthday === null && birthTime != null) {
    throw Object.assign(new Error('请先设置出生日期，再设置出生时刻'), { status: 400 });
  }

  const zodiacSign = birthday ? getZodiacFromDate(birthday) : null;

  await UserModel.updateProfile(userId, {
    birthday,
    zodiac_sign: zodiacSign,
    // Omission preserves old clients' saved time; clearing the date clears both.
    ...(birthday === null ? { birth_time: null } : birthTime !== undefined ? { birth_time: birthTime } : {}),
  });

  return getBirthInfo(userId);
}
