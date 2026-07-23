import { z } from 'zod';

const cardId = z.number({ invalid_type_error: '卡牌 ID 必须为整数' }).int().min(0).max(77);
const orientation = z.enum(['upright', 'reversed'], {
  errorMap: () => ({ message: '牌面方向须为 upright 或 reversed' }),
});
const readingQuestion = z.string({ required_error: '请输入问题' }).trim().min(5, '问题长度应在5-200字之间').max(200, '问题长度应在5-200字之间');

export const singleCardSchema = z.object({
  question: readingQuestion,
  cardId,
  orientation,
});

export const threeCardSchema = z.object({
  question: readingQuestion,
  cardIds: z.array(cardId).length(3, '三卡占卜必须提交三张牌').refine(
    (ids) => new Set(ids).size === ids.length,
    '三张牌不能重复',
  ),
  orientations: z.array(orientation).length(3, '三张牌必须分别提供牌面方向'),
});

const dailyZodiacSigns = ['摩羯', '水瓶', '双鱼', '白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手'] as const;

export const dailyFortuneSchema = z.object({
  zodiacSign: z.enum(dailyZodiacSigns, { errorMap: () => ({ message: '星座参数无效' }) }).optional(),
  cardId: cardId.optional(),
  isReversed: z.boolean({ invalid_type_error: 'isReversed 必须为布尔值' }).optional(),
});

export const horoscopeQuerySchema = z.object({
  sign: z.enum(
    ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'],
    { errorMap: () => ({ message: '无效的星座' }) },
  ),
  period: z.enum(['today', 'tomorrow', 'week'], {
    errorMap: () => ({ message: '运势周期须为 today、tomorrow 或 week' }),
  }).default('today'),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1, '页码必须大于 0').default(1),
  limit: z.coerce.number().int().min(1).max(100, '每页最多返回 100 条').default(20),
  type: z.enum(['single', 'three-card', 'daily-fortune', 'reader-reading']).optional(),
  search: z.string().trim().max(100, '搜索内容不能超过 100 字').optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式须为 YYYY-MM-DD').optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式须为 YYYY-MM-DD').optional(),
});

const optionalReaderCards = z.object({
  cardIds: z.array(cardId).min(1).max(10).optional(),
  orientations: z.array(orientation).min(1).max(10).optional(),
}).superRefine((value, ctx) => {
  if (Boolean(value.cardIds) !== Boolean(value.orientations)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '卡牌与牌面方向必须同时提交' });
    return;
  }
  if (value.cardIds && value.orientations && value.cardIds.length !== value.orientations.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '卡牌数量与牌面方向数量不一致' });
  }
  if (value.cardIds && new Set(value.cardIds).size !== value.cardIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '同一次占卜不能提交重复卡牌' });
  }
});

export const readerReadingSchema = z.object({
  readerId: z.string({ required_error: '请选择塔罗师' }).trim().min(1, '请选择塔罗师').max(50),
  spreadType: z.string({ required_error: '请选择牌阵' }).trim().min(1, '请选择牌阵').max(50),
  question: readingQuestion,
  category: z.string().trim().max(30, '问题分类不能超过 30 字').optional(),
}).and(optionalReaderCards);

export const readerFollowupSchema = z.object({
  readingId: z.coerce.number().int().positive('无效的占卜记录ID'),
  question: z.string({ required_error: '请输入追问' }).trim().min(2, '追问长度应在2-200字之间').max(200, '追问长度应在2-200字之间'),
  priorTurns: z.array(z.object({
    question: z.string().trim().min(1).max(200),
    answer: z.string().trim().min(1).max(2000),
  })).max(10, '最多提交最近 10 轮追问').optional(),
});

export const readingOutcomeSchema = z.object({
  rating: z.enum(['full', 'partial', 'none'], {
    errorMap: () => ({ message: 'rating 须为 full、partial 或 none' }),
  }),
});
