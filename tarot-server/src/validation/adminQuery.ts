import { z } from 'zod';
import { clampAdminPage, clampAdminPageSize, parseFeedbackListStatus } from '../utils/adminHttp.js';

const pageQ = z.preprocess(
  (v) => clampAdminPage(v === undefined || v === '' ? 1 : v, 1),
  z.number().int().min(1).max(1_000_000),
);

const pageSizeQ = z.preprocess(
  (v) => clampAdminPageSize(v === undefined || v === '' ? 20 : v, 20, 100),
  z.number().int().min(1).max(100),
);

const keywordQ = z.preprocess((v) => {
  if (v === undefined || v === '' || v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s.slice(0, 200) : undefined;
}, z.string().max(200).optional());

/** GET /api/admin/users */
export const adminListUsersQuerySchema = z.object({
  page: pageQ,
  pageSize: pageSizeQ,
  keyword: keywordQ,
});
export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;

const feedbackStatusQ = z.preprocess(
  (v) => parseFeedbackListStatus(v),
  z.enum(['pending', 'processing', 'resolved', 'closed']).optional(),
);

/** GET /api/admin/feedback */
export const adminListFeedbackQuerySchema = z.object({
  page: pageQ,
  pageSize: pageSizeQ,
  status: feedbackStatusQ,
});
export type AdminListFeedbackQuery = z.infer<typeof adminListFeedbackQuerySchema>;
