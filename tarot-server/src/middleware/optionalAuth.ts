import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice(7));
      req.userId = payload.userId;
    } catch {
      // Token invalid, proceed without auth
    }
  }
  next();
}
