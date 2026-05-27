import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as UserController from '../controllers/user.controller.js';
import { getUploadsRoot } from '../config/uploadsRoot.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

// Avatar upload config
const avatarStorage = multer.diskStorage({
  destination: path.join(getUploadsRoot(), 'avatars'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/GIF/WebP 格式'));
    }
  },
});

const updateProfileSchema = z.object({
  nickname: z.string().min(2).max(20).optional(),
  avatar: z.string().max(255).optional(),
  gender: z.enum(['male', 'female', 'other', 'unset']).optional(),
  birthday: z.string().nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().max(100).optional().default(''),
  newPassword: z.string().min(6, '新密码至少6个字符').max(50),
});

const updateBirthInfoSchema = z.object({
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD')
    .nullable(),
});

const updateSettingsSchema = z.object({
  cardBack: z.string().max(50).optional(),
  cardBackCode: z.string().max(50).optional(),
  settings: z.record(z.any()).optional(),
});

router.get('/profile', auth, UserController.getProfile);
router.put('/profile', auth, validate(updateProfileSchema), UserController.updateProfile);
router.put('/password', auth, validate(changePasswordSchema), UserController.changePassword);
router.get('/quota', auth, UserController.getQuota);
router.get('/settings', auth, UserController.getSettings);
router.put('/settings', auth, validate(updateSettingsSchema), UserController.updateSettings);
router.get('/birth-info', auth, UserController.getBirthInfo);
router.put('/birth-info', auth, validate(updateBirthInfoSchema), UserController.updateBirthInfo);
router.post('/avatar', auth, avatarUpload.single('avatar'), UserController.uploadAvatar);
router.post('/activate-vip', auth, UserController.activateVip);

export default router;
