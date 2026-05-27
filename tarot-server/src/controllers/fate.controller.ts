import type { Request, Response } from 'express';
import * as FateService from '../services/fate.service.js';
import { success, fail } from '../utils/response.js';

function getErrMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function mysqlHint(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const o = err as { code?: string; errno?: number };
  if (o.code === 'ER_NO_SUCH_TABLE' || o.errno === 1146) {
    return '数据库缺少命运双盘相关表。请在 MySQL 中执行：tarot-server/migrations/013_fate_dual_engine.sql 后重启服务。';
  }
  if (o.code === 'ER_BAD_FIELD_ERROR' || o.errno === 1054) {
    return '数据库字段与当前代码不一致，请重新执行最新迁移（含 013_fate_dual_engine.sql）。';
  }
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export async function analyze(req: Request, res: Response) {
  try {
    const { birth_date: birthDate, birth_time: birthTime, question, category } = req.body as Record<
      string,
      unknown
    >;

    if (typeof birthDate !== 'string' || !DATE_RE.test(birthDate)) {
      res.status(400).json(fail('birth_date 需为 YYYY-MM-DD'));
      return;
    }
    let timeVal: string | null = null;
    if (birthTime != null && birthTime !== '') {
      if (typeof birthTime !== 'string' || !TIME_RE.test(birthTime)) {
        res.status(400).json(fail('birth_time 需为 HH:mm 或 HH:mm:ss'));
        return;
      }
      timeVal = birthTime.length === 5 ? `${birthTime}:00` : birthTime;
    }

    if (typeof question !== 'string' || question.trim().length < 5 || question.trim().length > 300) {
      res.status(400).json(fail('问题长度应在 5–300 字之间'));
      return;
    }

    const cat = typeof category === 'string' ? category.trim() : '';
    if (!['love', 'career', 'wealth'].includes(cat)) {
      res.status(400).json(fail('category 须为 love | career | wealth'));
      return;
    }

    const body = req.body as Record<string, unknown>;
    const cardIdsRaw = body.card_ids ?? body.cardIds;
    const orientRaw = body.orientations;
    if (!Array.isArray(cardIdsRaw) || cardIdsRaw.length !== 3) {
      res.status(400).json(fail('须提交 3 个 card_ids（过去·现在·未来顺序）'));
      return;
    }
    const cardIds = cardIdsRaw.map((x) => Number(x));
    if (cardIds.some((n) => !Number.isInteger(n) || n < 0)) {
      res.status(400).json(fail('card_ids 须为非负整数'));
      return;
    }
    if (!Array.isArray(orientRaw) || orientRaw.length !== 3) {
      res.status(400).json(fail('须提交 3 个 orientations：upright 或 reversed'));
      return;
    }
    const orientations: ('upright' | 'reversed')[] = [];
    for (const o of orientRaw) {
      if (o !== 'upright' && o !== 'reversed') {
        res.status(400).json(fail('orientations 每项须为 upright 或 reversed'));
        return;
      }
      orientations.push(o);
    }

    const data = await FateService.analyzeFateDual(req.userId!, {
      birthDate,
      birthTime: timeVal,
      question: question.trim(),
      category: cat,
      cardIds,
      orientations,
    });
    res.json(success(data));
  } catch (err: unknown) {
    const hint = mysqlHint(err);
    if (hint) {
      res.status(503).json(fail(hint));
      return;
    }
    res.status(500).json(fail(getErrMsg(err, '命运双盘分析失败')));
  }
}

export async function choose(req: Request, res: Response) {
  try {
    const { conflict_id: conflictIdRaw, choice: choiceRaw } = req.body as Record<string, unknown>;

    const conflictId = Number(conflictIdRaw);
    if (!Number.isInteger(conflictId) || conflictId <= 0) {
      res.status(400).json(fail('conflict_id 无效'));
      return;
    }

    let choice: 'stable' | 'adventure' | null = null;
    if (choiceRaw === 'stable' || choiceRaw === '命' || choiceRaw === 'A' || choiceRaw === 'a') {
      choice = 'stable';
    } else if (
      choiceRaw === 'adventure' ||
      choiceRaw === '心' ||
      choiceRaw === 'B' ||
      choiceRaw === 'b'
    ) {
      choice = 'adventure';
    }
    if (!choice) {
      res.status(400).json(fail('choice 须为 stable/adventure 或 命/心'));
      return;
    }

    const data = await FateService.chooseFatePath(req.userId!, conflictId, choice);
    res.json(success(data));
  } catch (err: unknown) {
    const hint = mysqlHint(err);
    if (hint) {
      res.status(503).json(fail(hint));
      return;
    }
    const msg = getErrMsg(err, '提交选择失败');
    if (msg.includes('不存在') || msg.includes('无权')) {
      res.status(404).json(fail(msg));
      return;
    }
    res.status(500).json(fail(msg));
  }
}

export async function history(req: Request, res: Response) {
  try {
    const raw = Number(req.query.limit);
    const lim = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 50) : 20;
    const data = await FateService.getFateHistory(req.userId!, lim);
    res.json(success(data));
  } catch (err: unknown) {
    const hint = mysqlHint(err);
    if (hint) {
      res.status(503).json(fail(hint));
      return;
    }
    res.status(500).json(fail(getErrMsg(err, '获取历史失败')));
  }
}
