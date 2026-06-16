import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import * as UserModel from '../models/user.model.js';
import * as TokenModel from '../models/token.model.js';
import * as PasswordResetModel from '../models/passwordReset.model.js';
import { normalizeEmail } from '../utils/emailNormalize.js';
import { toDateOnly } from '../utils/dateOnly.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';
import { env } from '../config/env.js';
import type { PublicUser } from '../types/index.js';
import type { DbUser } from '../types/index.js';

function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    nickname: user.nickname,
    avatar: user.avatar ?? '🔮',
    gender: user.gender,
    birthday: toDateOnly(user.birthday),
    zodiacSign: user.zodiac_sign,
    location: user.location,
    bio: user.bio,
    membership: user.membership,
    membershipExpiresAt: user.membership_expires_at,
    remainingFreeQuota: user.remaining_free_quota,
    createdAt: user.created_at,
  };
}

/**
 * 规范化生日为 'YYYY-MM-DD'。
 * mysql2 把 DATE 列解析为「本地零点」的 Date 对象，直接 toISOString() 会按 UTC 回退一天，
 * 因此用本地年月日分量还原，避免前端预填生日 / 星座出现 -1 天偏差。
 */
function formatBirthday(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = `${value.getMonth() + 1}`.padStart(2, '0');
    const d = `${value.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  const match = s.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/** 用户名规则：3–20 位，字母/数字/下划线，且不能是纯数字（避免与手机号歧义） */
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
function normalizeUsername(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const u = String(raw).trim();
  if (!u) return null;
  if (!USERNAME_RE.test(u)) {
    throw new Error('用户名需为 3-20 位字母、数字或下划线');
  }
  if (/^\d+$/.test(u)) {
    throw new Error('用户名不能为纯数字');
  }
  return u.toLowerCase();
}

/** 判断登录标识符是否像邮箱 */
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function issueNewSession(userId: number): Promise<{
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}> {
  const accessToken = signAccessToken({ userId });
  const refreshToken = signRefreshToken({ userId });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await TokenModel.saveRefreshToken(userId, refreshToken, expiresAt);
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function register(
  email: string,
  nickname: string,
  password: string,
  username?: string | null,
) {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) {
    throw new Error('请输入邮箱');
  }
  const existing = await UserModel.findByEmail(emailNorm);
  if (existing) {
    throw new Error('该邮箱已被注册');
  }

  // 用户名可选；提供则校验格式并查重
  const usernameNorm = normalizeUsername(username);
  if (usernameNorm) {
    const dup = await UserModel.findByUsername(usernameNorm);
    if (dup) {
      throw new Error('该用户名已被占用');
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await UserModel.create({
    email: emailNorm,
    nickname,
    passwordHash,
    username: usernameNorm,
  });
  return issueNewSession(userId);
}

/**
 * 登录：支持「用户名或邮箱 + 密码」。
 * identifier 形似邮箱则按邮箱归一化查找，否则按用户名/邮箱联合查找。
 */
export async function login(identifier: string, password: string) {
  const raw = (identifier ?? '').trim();
  if (!raw) {
    throw new Error('账号或密码错误');
  }

  let user: DbUser | null;
  if (looksLikeEmail(raw)) {
    user = await UserModel.findByEmail(normalizeEmail(raw));
  } else {
    user = await UserModel.findByUsernameOrEmail(raw);
  }

  if (!user) {
    throw new Error('账号或密码错误');
  }

  if (!user.password_hash) {
    throw new Error('该账号请使用 Google 登录');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error('账号或密码错误');
  }

  return issueNewSession(user.id);
}

/**
 * 手机号登录（占位接口）。
 * 当前仅预留：尚未接入短信验证码服务，调用即返回未实现。
 * 待接入后：校验验证码 → UserModel.findByPhone → 无则建号 → issueNewSession。
 */
export async function loginWithPhone(_phone: string, _code: string): Promise<never> {
  throw new Error('手机号登录尚未开放，敬请期待');
}

export async function signInWithGoogleIdToken(idToken: string) {
  const cid = env.GOOGLE_CLIENT_ID?.trim();
  if (!cid) {
    throw new Error('服务器未配置 Google 登录');
  }

  const client = new OAuth2Client(cid);
  let payload: TokenPayload | undefined;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: cid });
    payload = ticket.getPayload() ?? undefined;
  } catch {
    throw new Error('Google 令牌无效或已过期');
  }

  if (!payload?.sub || !payload.email) {
    throw new Error('无法从 Google 账户获取邮箱');
  }
  if (!payload.email_verified) {
    throw new Error('请先验证您的 Google 邮箱');
  }

  const googleId = payload.sub;
  const email = normalizeEmail(payload.email);
  const nicknameRaw = (payload.name?.trim() || email.split('@')[0] || '用户').slice(0, 50);
  const nickname = nicknameRaw.slice(0, 20);
  let picture = payload.picture?.trim() ?? null;
  if (picture && picture.length > 500) {
    picture = picture.slice(0, 500);
  }

  let user = await UserModel.findByGoogleId(googleId);
  if (user) {
    return issueNewSession(user.id);
  }

  const byEmail = await UserModel.findByEmail(email);
  if (byEmail) {
    if (byEmail.google_id && byEmail.google_id !== googleId) {
      throw new Error('该邮箱已绑定其他 Google 账号');
    }
    if (!byEmail.google_id) {
      await UserModel.setGoogleId(byEmail.id, googleId);
    }
    return issueNewSession(byEmail.id);
  }

  const userId = await UserModel.create({
    email,
    nickname,
    passwordHash: null,
    avatar: picture ?? '🔮',
    googleId,
  });
  return issueNewSession(userId);
}

/**
 * 忘记密码：无论邮箱是否存在均静默成功（防邮箱枚举）。
 * 若未配置 APP_PUBLIC_ORIGIN 或 SMTP，仅记录日志，用户收不到邮件。
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm) {
    return;
  }

  const user = await UserModel.findByEmail(emailNorm);
  if (!user) {
    return;
  }

  await PasswordResetModel.invalidateUnusedTokensForUser(user.id);
  const plain = randomBytes(24).toString('hex');
  const tokenHash = createHash('sha256').update(plain).digest('hex');
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_HOURS * 60 * 60 * 1000);
  await PasswordResetModel.insertPasswordResetToken(user.id, tokenHash, expiresAt);

  const origin = env.APP_PUBLIC_ORIGIN?.trim();
  if (!origin) {
    if (env.NODE_ENV === 'development') {
      console.warn('[auth] APP_PUBLIC_ORIGIN 未设置，无法生成重置链接。开发令牌:', plain);
    }
    return;
  }

  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(plain)}`;
  try {
    await sendPasswordResetEmail(emailNorm, resetUrl);
  } catch (e) {
    console.error('[auth] sendPasswordResetEmail failed', e);
  }
}

export async function resetPasswordWithToken(plainToken: string, newPassword: string): Promise<void> {
  const tokenHash = createHash('sha256').update(plainToken).digest('hex');
  const row = await PasswordResetModel.findValidPasswordResetByHash(tokenHash);
  if (!row) {
    throw new Error('重置链接无效或已过期');
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await UserModel.updatePassword(row.user_id, hash);
  await PasswordResetModel.markPasswordResetTokenUsed(row.id);
  await PasswordResetModel.invalidateUnusedTokensForUser(row.user_id);
  // 重置密码后注销该用户所有已登录会话，防止账号被盗后攻击者的旧会话仍然有效
  await TokenModel.deleteAllUserTokens(row.user_id);
}

export async function refresh(oldRefreshToken: string) {
  const tokenRecord = await TokenModel.findRefreshToken(oldRefreshToken);
  if (!tokenRecord) {
    throw new Error('无效的刷新令牌');
  }

  if (new Date(tokenRecord.expires_at) < new Date()) {
    await TokenModel.deleteRefreshToken(oldRefreshToken);
    throw new Error('刷新令牌已过期');
  }

  await TokenModel.deleteRefreshToken(oldRefreshToken);
  return issueNewSession(tokenRecord.user_id);
}

export async function logout(userId: number, refreshToken?: string) {
  if (refreshToken) {
    await TokenModel.deleteRefreshToken(refreshToken);
  } else {
    await TokenModel.deleteAllUserTokens(userId);
  }
}

export { toPublicUser };
