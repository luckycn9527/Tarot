import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface AdminTokenPayload {
  adminId: number;
}

const ADMIN_TOKEN_EXPIRES_IN: '12h' = '12h';

export function hashAdminUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  return crypto
    .createHmac('sha256', env.ADMIN_USERNAME_PEPPER)
    .update(normalized)
    .digest('hex');
}

function getAdminJwtSecret(): string {
  // env 已强制要求 ADMIN_JWT_SECRET，生产环境不会回退
  return env.ADMIN_JWT_SECRET;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, getAdminJwtSecret(), {
    expiresIn: ADMIN_TOKEN_EXPIRES_IN,
  });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, getAdminJwtSecret()) as AdminTokenPayload;
}
