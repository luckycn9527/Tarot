import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { fail } from '../utils/response.js';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json(fail('未登录'));
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json(fail('登录已过期，请重新登录'));
  }
}
