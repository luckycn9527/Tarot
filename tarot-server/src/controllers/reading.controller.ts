import type { Request, Response } from 'express';
import * as ReadingService from '../services/reading.service.js';
import * as HoroscopeService from '../services/horoscope.service.js';
import { isAiServiceError } from '../services/deepseek.service.js';
import { success, fail } from '../utils/response.js';

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
    const { question, cardId, orientation } = req.body;
    if (!question || question.length < 5 || question.length > 200) {
      res.status(400).json(fail('问题长度应在5-200字之间'));
      return;
    }
    const result = await ReadingService.singleCardReading(req.userId!, question, cardId, orientation);
    res.json(success(result));
  } catch (err: unknown) {
    sendReadingError(res, err, '占卜失败');
  }
}

export async function threeCard(req: Request, res: Response) {
  try {
    const { question, cardIds, orientations } = req.body;
    if (!question || question.length < 5 || question.length > 200) {
      res.status(400).json(fail('问题长度应在5-200字之间'));
      return;
    }
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
      cardId !== undefined ? Number(cardId) : undefined,
      isReversed !== undefined ? Boolean(isReversed) : undefined,
    );
    res.json(success(result));
  } catch (err: unknown) {
    sendReadingError(res, err, '每日运势获取失败');
  }
}

export async function horoscope(req: Request, res: Response) {
  try {
    const sign = typeof req.query.sign === 'string' ? req.query.sign : '';
    const period = typeof req.query.period === 'string' ? req.query.period : 'today';
    if (!sign) {
      res.status(400).json(fail('请提供星座 sign'));
      return;
    }
    const result = await HoroscopeService.getHoroscope(sign, period);
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
    const { page, limit, type, search, dateFrom, dateTo } = req.query;
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 20;
    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json(fail('分页参数无效'));
      return;
    }
    const result = await ReadingService.getHistory(req.userId!, {
      page: pageNum,
      limit: limitNum,
      type: type as string | undefined,
      search: search as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
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
    const { rating } = req.body as { rating?: unknown };
    if (rating !== 'full' && rating !== 'partial' && rating !== 'none') {
      res.status(400).json(fail('rating 须为 full | partial | none'));
      return;
    }
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
    const data = await ReadingService.getInsights(req.userId!, 6);
    res.json(success(data));
  } catch (err: unknown) {
    sendReadingError(res, err, '分析失败');
  }
}

export async function readerReading(req: Request, res: Response) {
  try {
    const { readerId, spreadType, question, category, cardIds, orientations } = req.body;
    if (!readerId || typeof readerId !== 'string') {
      res.status(400).json(fail('请选择塔罗师'));
      return;
    }
    if (!spreadType || typeof spreadType !== 'string') {
      res.status(400).json(fail('请选择牌阵'));
      return;
    }
    if (!question || question.length < 5 || question.length > 200) {
      res.status(400).json(fail('问题长度应在5-200字之间'));
      return;
    }
    const result = await ReadingService.readerReading(
      req.userId!,
      readerId,
      spreadType,
      question,
      category || '其他',
      cardIds,
      orientations
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
    const { readingId, question, priorTurns } = req.body as {
      readingId?: unknown;
      question?: unknown;
      priorTurns?: unknown;
    };

    const id = Number(readingId);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json(fail('无效的占卜记录ID'));
      return;
    }
    if (typeof question !== 'string' || question.trim().length < 2 || question.trim().length > 200) {
      res.status(400).json(fail('追问长度应在2-200字之间'));
      return;
    }

    // 校验并裁剪历史轮次（仅取必要字段，防止注入超大上下文）
    let turns: { question: string; answer: string }[] | undefined;
    if (Array.isArray(priorTurns)) {
      turns = priorTurns
        .filter((t): t is { question: string; answer: string } =>
          !!t && typeof t === 'object' &&
          typeof (t as Record<string, unknown>).question === 'string' &&
          typeof (t as Record<string, unknown>).answer === 'string')
        .map((t) => ({ question: String(t.question).slice(0, 200), answer: String(t.answer).slice(0, 2000) }));
    }

    const result = await ReadingService.readerFollowup(req.userId!, id, question.trim(), turns);
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
