import type { Request, Response } from 'express';
import * as ReadingService from '../services/reading.service.js';
import { success, fail } from '../utils/response.js';

function getErrMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
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
    res.status(500).json(fail(getErrMsg(err, '占卜失败')));
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
    res.status(500).json(fail(getErrMsg(err, '占卜失败')));
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
    res.status(500).json(fail(getErrMsg(err, '每日运势获取失败')));
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
    if (msg === '该塔罗师仅限VIP会员使用') {
      res.status(403).json(fail(msg));
      return;
    }
    res.status(500).json(fail(msg));
  }
}
