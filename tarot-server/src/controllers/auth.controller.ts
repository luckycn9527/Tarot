import type { Request, Response, CookieOptions } from 'express';
import * as AuthService from '../services/auth.service.js';
import { success, fail } from '../utils/response.js';
import { env } from '../config/env.js';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export async function register(req: Request, res: Response) {
  try {
    const { email, nickname, password } = req.body;
    const result = await AuthService.register(email, nickname, password);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());

    res.status(201).json(success({
      user: result.user,
      accessToken: result.accessToken,
    }, '注册成功'));
  } catch (err: any) {
    res.status(400).json(fail(err.message));
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);

    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());

    res.json(success({
      user: result.user,
      accessToken: result.accessToken,
    }, '登录成功'));
  } catch (err: any) {
    res.status(401).json(fail(err.message));
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json(fail('未提供刷新令牌'));
      return;
    }

    const result = await AuthService.refresh(token);

    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());

    res.json(success({
      user: result.user,
      accessToken: result.accessToken,
    }));
  } catch (err: any) {
    res.clearCookie('refreshToken', { path: '/api/auth', ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}) });
    res.status(401).json(fail(err.message));
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken;
    await AuthService.logout(req.userId!, token);
    res.clearCookie('refreshToken', { path: '/api/auth', ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}) });
    res.json(success(null, '已退出登录'));
  } catch (err: any) {
    res.status(500).json(fail(err.message));
  }
}

export async function googleSignIn(req: Request, res: Response) {
  try {
    const { idToken } = req.body as { idToken?: string };
    const result = await AuthService.signInWithGoogleIdToken(String(idToken ?? ''));

    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions());

    res.json(
      success(
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        '登录成功',
      ),
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Google 登录失败';
    if (msg.includes('未配置')) {
      res.status(503).json(fail(msg, { code: 'google_oauth_disabled' }));
      return;
    }
    if (msg.includes('绑定')) {
      res.status(409).json(fail(msg, { code: 'google_account_conflict' }));
      return;
    }
    res.status(401).json(fail(msg, { code: 'google_token_invalid' }));
  }
}

/** 防枚举：始终 200 + 相同提示 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body as { email?: string };
    await AuthService.requestPasswordReset(String(email ?? ''));
  } catch {
    /* 静默 */
  }
  res.json(success(null, '若该邮箱已注册，将收到重置邮件，请查收收件箱或垃圾箱'));
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    await AuthService.resetPasswordWithToken(String(token ?? ''), String(newPassword ?? ''));
    res.json(success(null, '密码已重置，请使用新密码登录'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '重置失败';
    res.status(400).json(fail(msg, { code: 'password_reset_invalid' }));
  }
}
