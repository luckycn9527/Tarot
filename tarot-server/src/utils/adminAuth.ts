import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface AdminTokenPayload {
  adminId: number;
}

const ADMIN_TOKEN_EXPIRES_IN = '12h';

export function hashAdminUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  return crypto
    .createHmac('sha256', env.ADMIN_USERNAME_PEPPER)
    .update(normalized)
    .digest('hex');
}

function getAdminJwtSecret(): string {
  return env.ADMIN_JWT_SECRET || env.JWT_ACCESS_SECRET;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, getAdminJwtSecret(), {
    expiresIn: ADMIN_TOKEN_EXPIRES_IN as any,
  });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, getAdminJwtSecret()) as AdminTokenPayload;
}
