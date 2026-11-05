import type { NextFunction, Request, Response } from 'express';
import * as AuthService from '../services/auth.service.js';
import { success } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';

/** Applies before auth/validation, including their error responses. Never sets a cookie. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, email, password } = req.body as { identifier?: string; email?: string; password: string };
    res.json(success(await AuthService.login(identifier ?? email ?? '', password, 'native'), '登录成功'));
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === '账号或密码错误' || message === '该账号请使用 Google 登录') {
      next(new ApiError(401, message));
    } else {
      next(error);
    }
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(success(await AuthService.refreshNative(req.body.refreshToken)));
  } catch (error) { next(error); }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AuthService.logoutNative(req.userId!, req.body.refreshToken);
    res.json(success(null, '已退出登录'));
  } catch (error) { next(error); }
}
