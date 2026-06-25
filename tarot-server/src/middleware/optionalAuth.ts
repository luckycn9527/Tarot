import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import * as UserModel from '../models/user.model.js';

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice(7));

      // 检查 access token 是否已被吊销
      const user = await UserModel.findById(payload.userId);
      if (user?.access_token_revoked_at) {
        const revokedAt = new Date(user.access_token_revoked_at).getTime();
        const issuedAt = payload.iat * 1000;
        if (issuedAt > revokedAt) {
          req.userId = payload.userId;
        }
        // 否则 token 已被吊销，按未登录处理
      } else if (user) {
        req.userId = payload.userId;
      }
    } catch {
      // Token invalid, proceed without auth
    }
  }
  next();
}
