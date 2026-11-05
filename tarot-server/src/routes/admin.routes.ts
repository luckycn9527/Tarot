import * as ConfigHistoryController from '../controllers/configHistory.controller.js';
import { configMatchSchema, putCardBacksSchema, putCardsSchema, putReaderPromptsSchema, putFeaturedReadersSchema, rollbackConfigSchema, configHistoryQuerySchema } from '../validation/adminConfig.js';
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import * as AdminController from '../controllers/admin.controller.js';
import { adminAuditLog } from '../middleware/adminAuditLog.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { adminListFeedbackQuerySchema, adminListUsersQuerySchema, adminUserQuestionsQuerySchema } from '../validation/adminQuery.js';
import { adminWriteLimiter, authLimiter } from '../middleware/rateLimiter.js';
import { imageMimeFilter } from '../utils/imageUpload.js';

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

const createInvitationSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{4,50}$/, '邀请码格式无效').optional(),
  type: z.enum(['quota', 'vip_days']),
  value: z.number().int().min(1).max(3650),
  maxUses: z.number().int().min(1).max(1_000_000),
  expiresAt: z.string().datetime().nullable(),
});

const patchInvitationSchema = z.object({
  isActive: z.boolean(),
});

const replyFeedbackSchema = z.object({
  adminReply: z.string().min(1, '请填写回复内容').max(20_000),
  status: z.enum(['pending', 'processing', 'resolved', 'closed']).default('resolved'),
});

router.post('/auth/login', authLimiter, validate(loginSchema), AdminController.login);

router.get('/users', adminAuth, validateQuery(adminListUsersQuerySchema), AdminController.listUsers);
router.get('/users/:id/questions', adminAuth, adminAuditLog, validateQuery(adminUserQuestionsQuerySchema), AdminController.listUserQuestions);
router.patch(
  '/users/:id',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(patchUserSchema),
  AdminController.updateUser,
);

router.get('/invitations', adminAuth, AdminController.listInvitationCodes);
router.post(
  '/invitations',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(createInvitationSchema),
  AdminController.createInvitationCode,
);
router.patch(
  '/invitations/:id',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(patchInvitationSchema),
  AdminController.setInvitationCodeActive,
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
  validate(configMatchSchema),
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

router.get('/config/featured-readers', adminAuth, AdminController.getFeaturedReaders);
router.put(
  '/config/featured-readers',
  adminAuth,
  adminAuditLog,
  adminWriteLimiter,
  validate(putFeaturedReadersSchema),
  AdminController.putFeaturedReaders,
);

router.get('/config-history', adminAuth, validateQuery(configHistoryQuerySchema), ConfigHistoryController.list);
router.get('/config-history/:id', adminAuth, adminAuditLog, ConfigHistoryController.detail);
router.get('/config-history/:id/rollback-preview', adminAuth, adminAuditLog, ConfigHistoryController.preview);
router.post('/config-history/:id/rollback', adminAuth, adminAuditLog, adminWriteLimiter, validate(rollbackConfigSchema), ConfigHistoryController.rollback);

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

const adminUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageMimeFilter,
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
