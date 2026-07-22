import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { checkDatabaseConnection, testConnection } from './config/database.js';
import { getRedisHealth } from './config/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { assignRequestId } from './middleware/requestId.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import readingRoutes from './routes/reading.routes.js';
import shareRoutes from './routes/share.routes.js';
import invitationRoutes from './routes/invitation.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import referenceRoutes from './routes/reference.routes.js';
import adminRoutes from './routes/admin.routes.js';
import fateRoutes from './routes/fate.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import { ensureDefaultUploadAssets } from './utils/ensureDefaultUploadAssets.js';
import { getUploadsRoot } from './config/uploadsRoot.js';
import { startHoroscopeScheduler } from './services/horoscope.service.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 反向代理（Nginx）后部署：信任代理，使 req.protocol/secure 反映真实的 https。
// 若服务允许绕过代理直连，应将 TRUST_PROXY 配为 0。
app.set('trust proxy', env.TRUST_PROXY);

// 上传目录（multer 不落盘若目录不存在；与 cwd 无关）
const uploadsRoot = getUploadsRoot();
for (const sub of ['', 'avatars', 'admin', 'card-backs', 'cards'] as const) {
  fs.mkdirSync(sub ? path.join(uploadsRoot, sub) : uploadsRoot, { recursive: true });
}
ensureDefaultUploadAssets(uploadsRoot);

// Global middleware
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://accounts.google.com"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "connect-src": ["'self'", "https://accounts.google.com"],
      "frame-src": ["'self'", "https://accounts.google.com"],
      "base-uri": ["'self'"],
      "object-src": ["'none'"],
      "frame-ancestors": ["'self'"],
    },
  },
  // http://IP:port 非「可信源」时浏览器会忽略 COOP 并刷屏告警；同源静态+API 场景可关闭
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  // 前端 dev（如 5173）通过绝对 URL 拉取 API 的 /uploads 图片；默认 same-origin 会触发 ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
// Creem signature covers the exact byte sequence. This must run before express.json().
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '512kb' }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(assignRequestId);
// 全局限流会统计 /assets/*.js、/uploads 等，Vue 懒加载 chunk 一多即 429；仅对 /api 限流
app.use('/api', apiLimiter);

// 用户上传资源：允许浏览器缓存一段时间（头像等可能更新，不宜 immutable）
app.use('/uploads', express.static(uploadsRoot, {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  setHeaders(res) {
    // 与 Helmet 一致且必须在发静态文件时带上，避免与 helmet 钩子顺序导致仍缺省为 same-origin → ERR_BLOCKED_BY_RESPONSE.NotSameOrigin（前端与静态资源不同源时）
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=604800');
  },
}));

// Liveness check：仅表示 HTTP 进程仍在响应，不依赖外部服务。
app.get('/health', async (_req, res) => {
  const redis = await getRedisHealth();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: redis.status,
  });
});

// Readiness check：供部署和监控确认服务可实际处理依赖数据库的请求。
app.get('/ready', async (_req, res) => {
  const redis = await getRedisHealth();
  try {
    await checkDatabaseConnection();
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'ok',
      redis: redis.status,
    });
  } catch {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      database: 'error',
      redis: redis.status,
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/readings', readingRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fate', fateRoutes);
app.use('/api/payments', paymentRoutes);

// Production: 可选由本进程托管前端；SERVE_STATIC_FRONTEND=false 时仅提供 API（前后端部署分离）
const frontendDist = path.resolve(__dirname, '..', '..', 'tarot-vue', 'dist');
if (env.SERVE_STATIC_FRONTEND && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.replace(/\\/g, '/').endsWith('/index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  // SPA fallback：勿吞掉 /assets/*（缺 chunk 时应真实 404，且避免 Nginx 只反代 /api 时误把资源请求落到 SPA）
  app.get('/{*splat}', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const p = req.path;
    if (
       p.startsWith('/api') ||
       p.startsWith('/uploads') ||
       p.startsWith('/health') ||
       p.startsWith('/ready') ||
       p.startsWith('/assets/')
    ) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  let assetCount = 0;
  try {
    const ad = path.join(frontendDist, 'assets');
    if (fs.existsSync(ad)) assetCount = fs.readdirSync(ad).length;
  } catch {
    /* ignore */
  }
  console.log(`📂 Serving frontend from ${frontendDist} (assets/: ${assetCount} files)`);
} else if (env.SERVE_STATIC_FRONTEND && !fs.existsSync(frontendDist)) {
  console.warn(
    `⚠️ SERVE_STATIC_FRONTEND 已开启但找不到构建目录: ${frontendDist}（请确认 tarot-vue 已 build 且与 tarot-server 为同级目录）`,
  );
} else if (!env.SERVE_STATIC_FRONTEND) {
  console.log('📡 API-only mode: static frontend not served (SERVE_STATIC_FRONTEND=false)');
}

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    await testConnection();
    const rh = await getRedisHealth();
    if (rh.status === 'ok') {
      console.log('✅ Redis: connected');
    } else if (rh.status === 'disabled') {
      console.log('ℹ️ Redis: disabled (set REDIS_URL to enable)');
    } else {
      console.warn('⚠️ Redis:', rh.status, rh.message ?? '');
    }
    if (env.NODE_ENV === 'production') {
      console.log('🔒 Admin JWT 已配置独立密钥');
    }
    app.listen(env.PORT, env.HOST, () => {
      console.log(`🚀 Server running on http://${env.HOST}:${env.PORT}`);
      console.log(`📦 Environment: ${env.NODE_ENV}`);
      // 启动每日星座运势预拉取调度（启动预热 + 每日 00:05 刷新）
      startHoroscopeScheduler();
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
