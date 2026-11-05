import { z } from 'zod';

export const mobileRequestId = z.string().uuid('无效的请求编号').transform(value => value.toLowerCase());
const question = z.string().trim().min(5, '问题长度应在5-200字之间').max(200, '问题长度应在5-200字之间');
const locale = z.enum(['zh-CN', 'en-US']).default('zh-CN');
export const mobileReadingSchema = z.object({
  requestId: mobileRequestId,
  readerId: z.string().trim().min(1).max(50),
  spreadType: z.enum(['single', 'problem', 'timeline']),
  question,
  category: z.string().trim().max(30).default('其他'),
  locale,
  cardIds: z.array(z.number().int().min(0).max(77)).min(1).max(3),
  orientations: z.array(z.enum(['upright', 'reversed'])).min(1).max(3),
}).superRefine((value, context) => {
  const count = value.spreadType === 'single' ? 1 : 3;
  if (value.cardIds.length !== count || value.orientations.length !== count) context.addIssue({
    code: z.ZodIssueCode.custom, path: ['cardIds'], message: `该牌阵需要 ${count} 张牌及对应方向`,
  });
  if (new Set(value.cardIds).size !== value.cardIds.length) context.addIssue({
    code: z.ZodIssueCode.custom, path: ['cardIds'], message: '同一次占卜不能提交重复卡牌',
  });
});
export const mobileFollowupSchema = z.object({
  requestId: mobileRequestId,
  readingId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  question: z.string().trim().min(2, '追问长度应在2-200字之间').max(200, '追问长度应在2-200字之间'),
  locale,
});
export type MobileReadingInput = z.infer<typeof mobileReadingSchema>;
export type MobileFollowupInput = z.infer<typeof mobileFollowupSchema>;
