import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { fail } from '../utils/response.js';
import * as UserModel from '../models/user.model.js';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json(fail('未登录'));
    return;
  }

  try {
    const payload = verifyAccessToken(header.slice(7));

    // 检查 access token 是否已被吊销
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      res.status(401).json(fail('用户不存在'));
      return;
    }

    if (user.access_token_revoked_at) {
      const revokedAt = new Date(user.access_token_revoked_at).getTime();
      // iat 是秒级时间戳
      const issuedAt = payload.iat * 1000;
      if (issuedAt <= revokedAt) {
        res.status(401).json(fail('登录已过期，请重新登录'));
        return;
      }
    }

    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json(fail('登录已过期，请重新登录'));
  }
}
