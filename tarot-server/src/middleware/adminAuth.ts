import type { NextFunction, Request, Response } from 'express';
import * as AdminModel from '../models/admin.model.js';
import { fail } from '../utils/response.js';
import { verifyAdminToken } from '../utils/adminAuth.js';

declare global {
  namespace Express {
    interface Request {
      adminId?: number;
    }
  }
}

export async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json(fail('未登录管理后台'));
    return;
  }
  try {
    const payload = verifyAdminToken(header.slice(7));
    const row = await AdminModel.findAdminActiveById(payload.adminId);
    if (!row || !row.is_active) {
      res.status(401).json(fail('管理后台登录已失效，请重新登录'));
      return;
    }
    req.adminId = payload.adminId;
    next();
  } catch {
    res.status(401).json(fail('管理后台登录已过期，请重新登录'));
  }
}
