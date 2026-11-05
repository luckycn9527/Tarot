import type { Request, Response, NextFunction } from 'express';
import * as ReadingService from '../services/reading.service.js';
import * as HoroscopeService from '../services/horoscope.service.js';
import { isAiServiceError } from '../services/deepseek.service.js';
import { success, fail } from '../utils/response.js';
import { env } from '../config/env.js';
import { quotaWindow } from '../utils/quotaDate.js';

function getErrMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function sendReadingError(res: Response, err: unknown, fallback: string) {
  if (isAiServiceError(err)) {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'warn',
        event: 'ai_service_error',
        message: err.message,
      }),
    );
    res.status(502).json(fail(err.safeMessage));
    return;
  }
  res.status(500).json(fail(getErrMsg(err, fallback)));
}

export async function singleCard(req: Request, res: Response) {
  try {
    const { question, cardId, orientation, requestId } = req.body;
    const result = await ReadingService.singleCardReading(req.userId!, question, cardId, orientation, requestId);
    res.json(success(result));
  } catch (err: unknown) {
    sendReadingError(res, err, '占卜失败');
  }
}

export async function threeCard(req: Request, res: Response) {
  try {
    const { question, cardIds, orientations } = req.body;
    const result = await ReadingService.threeCardReading(req.userId!, question, cardIds, orientations);
    res.json(success(result));
  } catch (err: unknown) {
    sendReadingError(res, err, '占卜失败');
  }
}

export async function dailyFortune(req: Request, res: Response) {
  try {
    const { zodiacSign, cardId, isReversed } = req.body;
    const result = await ReadingService.dailyFortune(
      req.userId!,
      zodiacSign,
      cardId,
      isReversed,
      res.locals.quotaWindow,
    );
    res.json(success(result));
  } catch (err: unknown) {
    sendReadingError(res, err, '每日运势获取失败');
  }
}

export async function dailyFortuneCache(req: Request, res: Response) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(success(await ReadingService.getDailyFortuneCache(req.userId!)));
  } catch (err) {
    sendReadingError(res, err, '每日运势获取失败');
  }
}

export async function yesterdayDailyFortuneCache(req: Request, res: Response) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(success(await ReadingService.getYesterdayDailyFortuneCache(req.userId!)));
  } catch (err) {
    sendReadingError(res, err, '昨日运势获取失败');
  }
}

/** Reopening today's result never consumes another generation allowance. */
export async function reuseDailyFortune(req: Request, res: Response, next: NextFunction) {
  try {
    const window = quotaWindow(env.QUOTA_TIME_ZONE);
    res.locals.quotaWindow = window;
    res.setHeader('Cache-Control', 'no-store');
    const cached = await ReadingService.getDailyFortuneCache(req.userId!, window);
    if (cached.cached) res.json(success(cached));
    else next();
  } catch (err) {
    sendReadingError(res, err, '每日运势获取失败');
  }
}

export async function horoscope(req: Request, res: Response) {
  try {
    const { sign, period, locale } = req.validatedQuery as {
      sign: string;
      period: 'today' | 'tomorrow' | 'week';
      locale: 'zh-CN' | 'en-US';
    };
    const result = await HoroscopeService.getHoroscope(sign, period, locale);
    res.json(success(result));
  } catch (err: unknown) {
    const msg = getErrMsg(err, '星座运势获取失败');
    if (msg === '无效的星座') {
      res.status(400).json(fail(msg));
      return;
    }
    res.status(500).json(fail(msg));
  }
}

export async function getHistory(req: Request, res: Response) {
  try {
    const { page, limit, type, search, dateFrom, dateTo } = req.validatedQuery as {
      page: number;
      limit: number;
      type?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    const result = await ReadingService.getHistory(req.userId!, {
      page,
      limit,
      type,
      search,
      dateFrom,
      dateTo,
    });
    res.json(success(result));
  } catch (err: unknown) {
    res.status(500).json(fail(getErrMsg(err, '获取历史记录失败')));
  }
}

export async function deleteHistory(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json(fail('无效的记录ID'));
      return;
    }
    await ReadingService.deleteHistory(req.userId!, id);
    res.json(success(null, '记录已删除'));
  } catch (err: unknown) {
    res.status(400).json(fail(getErrMsg(err, '删除失败')));
  }
}

export async function setOutcome(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json(fail('无效的记录ID'));
      return;
    }
    const { rating } = req.body as { rating: 'full' | 'partial' | 'none' };
    const data = await ReadingService.setReadingOutcome(req.userId!, id, rating);
    res.json(success(data, '感谢反馈'));
  } catch (err: unknown) {
    const msg = getErrMsg(err, '提交失败');
    if (msg.includes('不存在') || msg.includes('无权')) {
      res.status(404).json(fail(msg));
      return;
    }
    res.status(500).json(fail(msg));
  }
}

export async function getInsights(req: Request, res: Response) {
  try {
    const { locale } = req.validatedQuery as { locale: 'zh-CN' | 'en-US' };
    const data = await ReadingService.getInsights(req.userId!, 6, locale);
    res.json(success(data));
  } catch (err: unknown) {
    sendReadingError(res, err, '分析失败');
  }
}

export async function readerReading(req: Request, res: Response) {
  try {
    const { readerId, spreadType, question, category, cardIds, orientations, locale } = req.body;
    const result = await ReadingService.readerReading(
      req.userId!,
      readerId,
      spreadType,
      question,
      category || '其他',
      cardIds,
      orientations,
      locale,
    );
    res.json(success(result));
  } catch (err: unknown) {
    const msg = getErrMsg(err, '占卜失败');
    if (msg === '该塔罗师仅限VIP会员使用' || msg === '该牌阵仅限VIP会员使用') {
      res.status(403).json(fail(msg));
      return;
    }
    sendReadingError(res, err, '占卜失败');
  }
}

export async function readerFollowup(req: Request, res: Response) {
  try {
    const { readingId, question, priorTurns, locale } = req.body as {
      readingId: number;
      question: string;
      priorTurns?: { question: string; answer: string }[];
      locale: 'zh-CN' | 'en-US';
    };

    const result = await ReadingService.readerFollowup(req.userId!, readingId, question, priorTurns, locale);
    res.json(success(result));
  } catch (err: unknown) {
    const msg = getErrMsg(err, '追问失败');
    if (msg === '该塔罗师仅限VIP会员使用') {
      res.status(403).json(fail(msg));
      return;
    }
    if (msg.includes('不存在') || msg.includes('无权') || msg.includes('不支持追问')) {
      res.status(404).json(fail(msg));
      return;
    }
    sendReadingError(res, err, '追问失败');
  }
}
