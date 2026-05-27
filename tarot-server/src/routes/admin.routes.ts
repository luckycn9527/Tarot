import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import * as AdminController from '../controllers/admin.controller.js';
import { getUploadsRoot } from '../config/uploadsRoot.js';
import { adminAuditLog } from '../middleware/adminAuditLog.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { adminListFeedbackQuerySchema, adminListUsersQuerySchema } from '../validation/adminQuery.js';
import { adminWriteLimiter, authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(3, '用户名至少 3 位').max(64, '用户名最多 64 位'),
  password: z.string().min(6, '密码至少 6 位').max(100, '密码最多 100 位'),
});

const patchUserSchema = z.object({
  nickname: z.string().min(2).max(50).optional(),
  avatar: z.string().max(100).optional(),
  membership: z.enum(['free', 'vip']).optional(),
  membership_expires_at: z.string().datetime().nullable().optional(),
  remaining_free_quota: z.number().int().min(0).max(999).optional(),
});

const cardBackItemSchema = z.object({
  code: z.string().max(64),
  name: z.string().max(200),
  description: z.string().max(5000).nullable().optional(),
  assetUrl: z.string().max(500).nullable().optional(),
  isActive: z.boolean(),
  accessType: z.enum(['free', 'vip', 'paid']),
  price: z.number().min(0).max(1_000_000_000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1_000_000),
});

const putCardBacksSchema = z.object({
  items: z.array(cardBackItemSchema).max(200),
});

const cardConfigItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  nameEn: z.string().min(1).max(200),
  uprightKeywords: z.string().max(8000),
  reversedKeywords: z.string().max(8000),
  yesNoTendency: z.enum(['yes', 'no', 'neutral']),
  imageUrl: z.string().max(500).nullable().optional(),
  isActive: z.boolean(),
});

const putCardsSchema = z.object({
  items: z.array(cardConfigItemSchema).max(200),
});

const readerPromptItemSchema = z.object({
  readerCode: z.string().min(1).max(64),
  displayName: z.string().max(200).nullable().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
  emoji: z.string().max(32).nullable().optional(),
  accessLevel: z.enum(['free', 'vip']).nullable().optional(),
  systemPrompt: z.string().max(200_000),
  greeting: z.string().max(200_000),
});

const putReaderPromptsSchema = z.object({
  items: z.array(readerPromptItemSchema).max(200),
});

const replyFeedbackSchema = z.object({
  adminReply: z.string().min(1, '请填写回复内容').max(20_000),
  status: z.enum(['pending', 'processing', 'resolved', 'closed']).default('resolved'),
});

router.post('/auth/login', authLimiter, validate(loginSchema), AdminController.login);

router.get('/users', adminAuth, validateQuery(adminListUsersQuerySchema), AdminController.listUsers);
router.patch(
  '/users/:id',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(patchUserSchema),
  AdminController.updateUser,
);

router.get('/config/card-backs', adminAuth, AdminController.getCardBacks);
router.put(
  '/config/card-backs',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(putCardBacksSchema),
  AdminController.putCardBacks,
);
router.delete(
  '/config/card-backs/:id',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  AdminController.deleteCardBack,
);

router.get('/config/cards', adminAuth, AdminController.getCards);
router.put(
  '/config/cards',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(putCardsSchema),
  AdminController.putCards,
);

router.get('/config/readers-prompts', adminAuth, AdminController.getReaderPrompts);
router.put(
  '/config/readers-prompts',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(putReaderPromptsSchema),
  AdminController.putReaderPrompts,
);

router.get('/stats', adminAuth, AdminController.getStats);
router.get(
  '/feedback',
  adminAuth,
  validateQuery(adminListFeedbackQuerySchema),
  AdminController.listFeedback,
);
router.patch(
  '/feedback/:id',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(replyFeedbackSchema),
  AdminController.replyFeedback,
);

const adminUploadStorage = multer.diskStorage({
  destination: path.join(getUploadsRoot(), 'admin'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const type = (_req as any).query?.type || 'file';
    cb(null, `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const adminUpload = multer({
  storage: adminUploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持 JPG/PNG/GIF/WebP 图片格式'));
  },
});

router.post(
  '/upload',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  adminUpload.single('file'),
  AdminController.uploadFile,
);

export default router;
