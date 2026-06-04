import { callDeepSeek } from './deepseek.service.js';
import { SYSTEM_PROMPT, buildHoroscopePrompt } from '../utils/prompts.js';
import { cacheGet, cacheSet } from './cacheRedis.service.js';

/** 十二星座 key → 中文名（用于提示词） */
const SIGN_NAMES: Record<string, string> = {
  aries: '白羊座',
  taurus: '金牛座',
  gemini: '双子座',
  cancer: '巨蟹座',
  leo: '狮子座',
  virgo: '处女座',
  libra: '天秤座',
  scorpio: '天蝎座',
  sagittarius: '射手座',
  capricorn: '摩羯座',
  aquarius: '水瓶座',
  pisces: '双鱼座',
};

export const ZODIAC_SIGNS = Object.keys(SIGN_NAMES);

export interface HoroscopeResult {
  sign: string;
  date: string;
  summary: string;
  overallScore: number;
  sections: { overall: string; love: string; career: string; wealth: string; health: string };
  ratings: { overall: number; love: number; career: number; wealth: number; health: number };
  luckyColor: string;
  luckyNumber: number;
  /** 数据来源：source = 基于外部实时原文翻译扩展；ai = 纯 AI 生成兜底 */
  origin: 'source' | 'ai';
}

/** 进程内缓存：sign:date → 结果，配合 Redis 进一步降低重复生成 */
const memoryCache = new Map<string, HoroscopeResult>();

const HOROSCOPE_SOURCE_BASE = 'https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 拉取外部英文原文（失败返回 null，不阻断主流程，由 AI 兜底） */
async function fetchSourceHoroscope(sign: string, timeoutMs = 12000): Promise<string | null> {
  const signCapitalized = sign.charAt(0).toUpperCase() + sign.slice(1);
  const url = `${HOROSCOPE_SOURCE_BASE}?sign=${encodeURIComponent(signCapitalized)}&day=TODAY`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // 该接口对无尾斜杠路径会 308 重定向，fetch 默认跟随重定向
    const resp = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { data?: { horoscope?: unknown } };
    const text = json?.data?.horoscope;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function clampRating(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, n));
}

function parseJsonObject(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7).trim();
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3).trim();
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3).trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 返回中未找到可解析的 JSON 对象');
  const o = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new Error('AI 返回不是 JSON 对象');
  return o as Record<string, unknown>;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

/**
 * 获取某星座的今日运势。
 * 内容与用户无关、按 (星座, 日期) 缓存：每天每个星座至多生成一次，
 * 因此即便接口公开，对 AI 的调用上限也被限制为「12 次/天」。
 */
export async function getHoroscope(signRaw: string): Promise<HoroscopeResult> {
  const sign = String(signRaw || '').trim().toLowerCase();
  const signName = SIGN_NAMES[sign];
  if (!signName) throw new Error('无效的星座');

  const date = todayStr();
  const cacheKey = `horoscope:v2:${sign}:${date}`;

  const mem = memoryCache.get(cacheKey);
  if (mem) return mem;

  const cached = await cacheGet<HoroscopeResult>(cacheKey);
  if (cached) {
    memoryCache.set(cacheKey, cached);
    return cached;
  }

  // 1) 拉取外部实时英文原文（失败则为 null，由 AI 纯生成兜底）
  const sourceText = await fetchSourceHoroscope(sign);

  // 2) DeepSeek 翻译 + 扩展为结构化中文
  const responseText = await callDeepSeek(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildHoroscopePrompt(signName, date, sourceText ?? undefined) },
    ],
    45000,
    1200,
  );

  const data = parseJsonObject(responseText);
  const sectionsRaw = (data.sections ?? {}) as Record<string, unknown>;
  const ratingsRaw = (data.ratings ?? {}) as Record<string, unknown>;

  const ratings = {
    overall: clampRating(ratingsRaw.overall),
    love: clampRating(ratingsRaw.love),
    career: clampRating(ratingsRaw.career),
    wealth: clampRating(ratingsRaw.wealth),
    health: clampRating(ratingsRaw.health),
  };

  // 综合指数：优先用模型给的 overallScore（区分度更高）；缺失/越界则由五维星级换算兜底
  const rawScore = Math.round(Number(data.overallScore));
  const derivedScore = Math.round(
    ((ratings.overall + ratings.love + ratings.career + ratings.wealth + ratings.health) / 5 / 5) * 100,
  );
  const overallScore = Number.isFinite(rawScore) && rawScore >= 40 && rawScore <= 100
    ? rawScore
    : derivedScore;

  const result: HoroscopeResult = {
    sign,
    date,
    summary: str(data.summary, '今日能量平稳，宜顺势而为。'),
    overallScore,
    sections: {
      overall: str(sectionsRaw.overall, '整体平稳，适合按部就班地推进既定计划。'),
      love: str(sectionsRaw.love, '感情上保持真诚沟通，会有温暖的回应。'),
      career: str(sectionsRaw.career, '工作适合处理细节与收尾，循序渐进更稳妥。'),
      wealth: str(sectionsRaw.wealth, '财务宜稳健，避免冲动消费。'),
      health: str(sectionsRaw.health, '注意作息与休息，给身心留出余地。'),
    },
    ratings,
    luckyColor: str(data.luckyColor, '靛蓝'),
    luckyNumber: (() => {
      const n = Math.round(Number(data.luckyNumber));
      return Number.isFinite(n) ? Math.max(0, Math.min(9, n)) : 7;
    })(),
    origin: sourceText ? 'source' : 'ai',
  };

  memoryCache.set(cacheKey, result);
  // Redis 缓存 26 小时，跨越当日；内存缓存随进程生命周期
  await cacheSet(cacheKey, result, 26 * 3600);

  return result;
}


/** 预拉取全部 12 星座今日运势（拉源→翻译扩展→缓存），失败不阻断其它星座 */
export async function prefetchAllHoroscopes(): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const sign of ZODIAC_SIGNS) {
    try {
      await getHoroscope(sign);
      ok += 1;
    } catch (e) {
      failed += 1;
      console.warn(`[horoscope] 预拉取 ${sign} 失败:`, e instanceof Error ? e.message : e);
    }
    // 轻微间隔，避免同时打满外部源与 DeepSeek
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`[horoscope] 今日运势预拉取完成：成功 ${ok} / 失败 ${failed}`);
  return { ok, failed };
}

function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 5, 0, 0); // 次日 00:05，给跨天留余量
  return next.getTime() - now.getTime();
}

let schedulerStarted = false;

/**
 * 启动每日定时预拉取：
 * - 服务启动后稍作延迟先预热一次（不阻塞启动）
 * - 之后每天 00:05 重新拉取一次当日内容
 */
export function startHoroscopeScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // 启动预热（延迟 10s，避免与启动期其它初始化抢资源）
  setTimeout(() => {
    void prefetchAllHoroscopes();
  }, 10_000);

  const scheduleNext = () => {
    const delay = msUntilNextLocalMidnight();
    setTimeout(() => {
      void prefetchAllHoroscopes();
      scheduleNext();
    }, delay);
  };
  scheduleNext();
}
