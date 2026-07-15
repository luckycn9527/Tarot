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
    if (!['love', 'career', 'wealth', 'health', 'relationship', 'decision'].includes(cat)) {
      res.status(400).json(fail('category 无效'));
      return;
    }

    const body = req.body as Record<string, unknown>;
    const birthPlace = typeof body.birth_place === 'string' ? body.birth_place.trim().slice(0, 120) : null;
    const gender = body.gender === 'female' ? 'female' : body.gender === 'male' ? 'male' : null;
    const solarCorrection = body.solar_correction === true;
    const birthLongitudeRaw = Number(body.birth_longitude);
    const birthLongitude = Number.isFinite(birthLongitudeRaw) ? birthLongitudeRaw : null;
    if (solarCorrection && (!timeVal || birthLongitude == null || birthLongitude < 73 || birthLongitude > 135)) {
      res.status(400).json(fail('启用真太阳时校正时，须提供出生时间及 73–135°E 的出生地经度'));
      return;
    }

    const pillarPattern = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;
    let baziPillars: { year: string; month: string; day: string; time: string } | null = null;
    if (body.bazi_pillars && typeof body.bazi_pillars === 'object') {
      const p = body.bazi_pillars as Record<string, unknown>;
      const values = [p.year, p.month, p.day, p.time];
      if (values.every((value) => typeof value === 'string' && pillarPattern.test(value))) {
        baziPillars = {
          year: String(p.year), month: String(p.month), day: String(p.day), time: String(p.time),
        };
      }
    }

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

    // 命盘类型（可选）：bazi（默认）| ziwei
    const chartTypeRaw = body.chart_type ?? body.chartType;
    const chartType: 'bazi' | 'ziwei' = chartTypeRaw === 'ziwei' ? 'ziwei' : 'bazi';

    // 紫微命盘摘要（仅 ziwei 时使用，由前端排盘后传入）
    let ziwei: Parameters<typeof FateService.analyzeFateDual>[1]['ziwei'] = null;
    if (chartType === 'ziwei' && body.ziwei != null && typeof body.ziwei === 'object') {
      const z = body.ziwei as Record<string, unknown>;
      const asStr = (v: unknown, max = 40) =>
        typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
      const palaces = Array.isArray(z.palaces)
        ? z.palaces.filter((p): p is string => typeof p === 'string').map((p) => p.slice(0, 120)).slice(0, 12)
        : undefined;
      ziwei = {
        fiveElementsClass: asStr(z.fiveElementsClass),
        soul: asStr(z.soul),
        body: asStr(z.body),
        soulBranch: asStr(z.soulBranch, 4),
        bodyBranch: asStr(z.bodyBranch, 4),
        zodiac: asStr(z.zodiac, 4),
        sign: asStr(z.sign, 12),
        lunarDate: asStr(z.lunarDate, 60),
        palaces,
      };
    }

    const data = await FateService.analyzeFateDual(req.userId!, {
      birthDate,
      birthTime: timeVal,
      birthPlace,
      birthLongitude,
      gender,
      solarCorrection,
      baziPillars,
      question: question.trim(),
      category: cat,
      cardIds,
      orientations,
      chartType,
      ziwei,
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
