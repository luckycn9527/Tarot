import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import {
  authLimiter,
  passwordResetRequestLimiter,
  passwordResetConsumeLimiter,
} from '../middleware/rateLimiter.js';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  nickname: z.string().min(2, '昵称至少2个字符').max(20, '昵称最多20个字符'),
  password: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符'),
});

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

const googleSignInSchema = z.object({
  idToken: z.string().min(20, '缺少 Google 凭证'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32, '重置令牌无效'),
  newPassword: z.string().min(6, '新密码至少6个字符').max(50, '新密码最多50个字符'),
});

router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/google', authLimiter, validate(googleSignInSchema), AuthController.googleSignIn);
router.post(
  '/forgot-password',
  passwordResetRequestLimiter,
  validate(forgotPasswordSchema),
  AuthController.forgotPassword,
);
router.post(
  '/reset-password',
  passwordResetConsumeLimiter,
  validate(resetPasswordSchema),
  AuthController.resetPassword,
);
router.post('/refresh', AuthController.refreshToken);
router.post('/logout', auth, AuthController.logout);

export default router;
