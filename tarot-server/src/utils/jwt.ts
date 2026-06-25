import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: number;
}

export interface AccessTokenPayload extends TokenPayload {
  jti: string;
  iat: number;
  exp: number;
}

const ALLOWED_EXPIRES_IN = ['15m', '30m', '1h', '12h', '1d', '7d', '30d', '365d'] as const;
type ExpiresInString = typeof ALLOWED_EXPIRES_IN[number];

function normalizeExpiresIn(value: string): ExpiresInString {
  if (ALLOWED_EXPIRES_IN.includes(value as ExpiresInString)) {
    return value as ExpiresInString;
  }
  throw new Error(`不支持的 JWT 过期时间: ${value}`);
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, jti: randomUUID() },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: normalizeExpiresIn(env.JWT_ACCESS_EXPIRES_IN),
    },
  );
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: normalizeExpiresIn(env.JWT_REFRESH_EXPIRES_IN),
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}
