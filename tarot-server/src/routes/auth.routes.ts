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
  emailCode: z.string().length(6, '请输入6位验证码'),
  // 用户名可选：3-20 位字母/数字/下划线
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, '用户名需为 3-20 位字母、数字或下划线')
    .optional(),
  nickname: z.string().min(2, '昵称至少2个字符').max(20, '昵称最多20个字符'),
  password: z.string().min(6, '密码至少6个字符').max(50, '密码最多50个字符'),
});

const sendRegisterCodeSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
});

// 登录支持「用户名或邮箱」：用 identifier 字段，兼容旧的 email 字段
const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(1, '请输入密码'),
  })
  .refine((d) => Boolean(d.identifier || d.email), {
    message: '请输入用户名或邮箱',
    path: ['identifier'],
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
router.post('/send-register-code', authLimiter, validate(sendRegisterCodeSchema), AuthController.sendRegisterCode);
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
