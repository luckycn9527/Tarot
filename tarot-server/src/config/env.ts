import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5174),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

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

  // 管理后台登录：用户名哈希时使用的 pepper（务必在生产设置强随机值）
  ADMIN_USERNAME_PEPPER: z.string().default('change-this-admin-pepper'),
  ADMIN_JWT_SECRET: z.string().optional(),

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

export const env = parsed.data;
