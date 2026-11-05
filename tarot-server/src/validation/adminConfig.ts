import { z } from 'zod';
import { CONFIG_SCOPES } from '../utils/configHistory.js';

export const configMatchSchema = z.object({
  expectedRevision: z.number({ required_error: '配置版本缺失，请刷新页面后重试' }).int().min(0).max(Number.MAX_SAFE_INTEGER),
  expectedHash: z.string({ required_error: '配置版本缺失，请刷新页面后重试' }).regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().max(500).optional(),
});
function uniqueBy<T>(rows: T[], field: keyof T): boolean { return new Set(rows.map(row => row[field])).size === rows.length }
const cardBack = z.object({
  id: z.number().int().positive().optional(), code: z.string().trim().regex(/^[A-Za-z0-9_-]{1,50}$/, '牌背编码仅支持字母、数字、下划线和短横线'),
  name: z.string().min(1).max(100), description: z.string().max(5000).nullable().optional(), assetUrl: z.string().max(255).nullable().optional(),
  isActive: z.boolean(), accessType: z.enum(['free', 'vip', 'paid']), price: z.number().min(0).max(1_000_000_000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1_000_000),
});
const card = z.object({
  id: z.number().int().min(0).max(77), name: z.string().min(1).max(100), nameEn: z.string().min(1).max(100),
  uprightKeywords: z.string().max(255), reversedKeywords: z.string().max(255), yesNoTendency: z.enum(['yes', 'no', 'neutral']),
  imageUrl: z.string().max(255).nullable().optional(), isActive: z.boolean(),
});
const prompt = z.object({
  readerCode: z.string().min(1).max(32), displayName: z.string().max(200).nullable().optional(), avatarUrl: z.string().max(500).nullable().optional(),
  emoji: z.string().max(32).nullable().optional(), accessLevel: z.enum(['free', 'vip']).nullable().optional(),
  systemPrompt: z.string().max(200_000), greeting: z.string().max(200_000),
});
const featured = z.object({ readerCode: z.string().min(1).max(32), isActive: z.boolean(), sortOrder: z.number().int().min(0).max(1_000_000) });

export const putCardBacksSchema = configMatchSchema.extend({ items: z.array(cardBack).max(200).refine(rows => uniqueBy(rows, 'code'), '牌背编码不能重复') });
export const putCardsSchema = configMatchSchema.extend({ items: z.array(card).max(200).refine(rows => uniqueBy(rows, 'id'), '卡牌不能重复') });
export const putReaderPromptsSchema = configMatchSchema.extend({ items: z.array(prompt).max(200).refine(rows => uniqueBy(rows, 'readerCode'), '塔罗师不能重复') });
export const putFeaturedReadersSchema = configMatchSchema.extend({ items: z.array(featured).max(200).refine(rows => uniqueBy(rows, 'readerCode'), '推荐塔罗师不能重复') });
export const rollbackConfigSchema = configMatchSchema.extend({ reason: z.string().trim().min(3, '请填写至少 3 个字的回滚原因').max(500) });
export const configHistoryQuerySchema = z.object({
  scope: z.enum(CONFIG_SCOPES).optional(), page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
