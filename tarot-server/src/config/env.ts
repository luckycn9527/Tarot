import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5174),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // 0 means the app is directly reachable; 1 is the normal single-Nginx setup.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().default('tarot_qa'),

  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  /** 从 https://platform.deepseek.com/api_keys 创建；勿加引号、勿留首尾空格 */
  DEEPSEEK_API_KEY: z.preprocess((val) => {
    if (val == null || val === '') return undefined;
    if (typeof val !== 'string') return val;
    const t = val.trim();
    return t === '' ? undefined : t;
  }, z.string().optional()),
  /** 官方为 https://api.deepseek.com；兼容 OpenAI SDK 时可写 https://api.deepseek.com/v1（不要末尾 /） */
  DEEPSEEK_BASE_URL: z
    .string()
    .default('https://api.deepseek.com')
    .transform((s) => s.trim().replace(/\/+$/, '')),
  AI_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).max(60).default(8),

  // Creem payments. Keep disabled until products, API key and webhook secret are configured.
  CREEM_ENABLED: z.string().optional().transform((value) => value === 'true'),
  CREEM_API_KEY: z.preprocess((value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined), z.string().optional()),
  CREEM_WEBHOOK_SECRET: z.preprocess((value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined), z.string().optional()),
  CREEM_API_BASE_URL: z.string().url().default('https://api.creem.io').transform((value) => value.replace(/\/+$/, '')),
  CREEM_MONTHLY_PRODUCT_ID: z.preprocess((value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined), z.string().optional()),
  CREEM_YEARLY_PRODUCT_ID: z.preprocess((value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined), z.string().optional()),
  CREEM_MONTHLY_PRICE_CENTS: z.coerce.number().int().min(100).max(99999999).default(990),
  CREEM_YEARLY_PRICE_CENTS: z.coerce.number().int().min(100).max(99999999).default(8990),
  CREEM_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default('USD'),

  CORS_ORIGIN: z
    .string()
    .default(
      'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174',
    ),

  // 可选：启用 Redis 后缓存墓地标记、用户设置等读多写少数据
  REDIS_URL: z.string().optional(),

  // false：不托管 tarot-vue/dist，由 Nginx/CDN 单独托管前端（纯 API 模式）
  SERVE_STATIC_FRONTEND: z.string().optional().transform((v) => v !== 'false'),

  // Cookie 安全配置（HTTP 部署时必须设为 false）
  COOKIE_SECURE: z.string().optional().transform(v => v === 'true'),
  COOKIE_DOMAIN: z.string().optional(),

  // 管理后台登录：用户名哈希时使用的 pepper（生产环境必须设置强随机值）
  ADMIN_USERNAME_PEPPER: z.string().min(16),
  ADMIN_JWT_SECRET: z.string().min(16),

  /** Google Identity 前端 Client ID；未配置时 POST /api/auth/google 返回 503 */
  GOOGLE_CLIENT_ID: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().optional()),
  /** 密码重置邮件内链接前缀，如 https://example.com（无尾斜杠） */
  APP_PUBLIC_ORIGIN: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().optional())
    .transform((s) => (s ? s.trim().replace(/\/+$/, '') : undefined)),

  SMTP_HOST: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().optional()),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().optional()),
  SMTP_PASS: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().optional()),
  SMTP_FROM: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().optional()),
  /** 密码重置链接有效小时数 */
  PASSWORD_RESET_EXPIRES_HOURS: z.coerce.number().min(1).max(72).default(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

if (data.NODE_ENV === 'production') {
  const errors: Record<string, string[]> = {};
  const addError = (key: string, message: string) => {
    errors[key] = [...(errors[key] ?? []), message];
  };

  if (!data.COOKIE_SECURE) {
    addError('COOKIE_SECURE', 'production requires COOKIE_SECURE=true');
  }
  if (data.JWT_ACCESS_SECRET.length < 32) {
    addError('JWT_ACCESS_SECRET', 'production secret must be at least 32 characters');
  }
  if (data.JWT_REFRESH_SECRET.length < 32) {
    addError('JWT_REFRESH_SECRET', 'production secret must be at least 32 characters');
  }
  if (data.ADMIN_JWT_SECRET.length < 32) {
    addError('ADMIN_JWT_SECRET', 'production secret must be at least 32 characters');
  }
  if (data.ADMIN_USERNAME_PEPPER.length < 32) {
    addError('ADMIN_USERNAME_PEPPER', 'production pepper must be at least 32 characters');
  }
  const corsOrigins = data.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  if (
    corsOrigins.length === 0 ||
    corsOrigins.some((origin) => origin.includes('localhost') || origin.includes('127.0.0.1'))
  ) {
    addError('CORS_ORIGIN', 'production CORS_ORIGIN must contain only real public origins');
  }
  if (!data.APP_PUBLIC_ORIGIN?.startsWith('https://')) {
    addError('APP_PUBLIC_ORIGIN', 'production APP_PUBLIC_ORIGIN must be an https URL');
  }
  if (data.CREEM_ENABLED) {
    if (!data.CREEM_API_KEY) addError('CREEM_API_KEY', 'CREEM_ENABLED requires an API key');
    if (!data.CREEM_WEBHOOK_SECRET) addError('CREEM_WEBHOOK_SECRET', 'CREEM_ENABLED requires a webhook secret');
    if (!data.CREEM_MONTHLY_PRODUCT_ID) addError('CREEM_MONTHLY_PRODUCT_ID', 'CREEM_ENABLED requires a monthly product ID');
    if (!data.CREEM_YEARLY_PRODUCT_ID) addError('CREEM_YEARLY_PRODUCT_ID', 'CREEM_ENABLED requires a yearly product ID');
  }

  if (Object.keys(errors).length > 0) {
    console.error('❌ Unsafe production environment variables:', errors);
    process.exit(1);
  }
}

export const env = data;
