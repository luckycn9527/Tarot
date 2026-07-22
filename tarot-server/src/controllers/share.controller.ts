import type { Request, Response } from 'express';
import * as AuxModel from '../models/auxiliary.model.js';
import * as ReadingModel from '../models/reading.model.js';
import { success, fail } from '../utils/response.js';

export async function createShare(req: Request, res: Response) {
  try {
    const { readingId } = req.body;
    if (!readingId || !Number.isInteger(Number(readingId)) || Number(readingId) <= 0) {
      res.status(400).json(fail('readingId 无效'));
      return;
    }
    const reading = await ReadingModel.findById(Number(readingId), req.userId!);
    if (!reading) {
      res.status(404).json(fail('占卜记录不存在或无权操作'));
      return;
    }
    const shareCode = await AuxModel.createShare(req.userId!, Number(readingId));
    res.json(success({ shareCode }, '分享链接已创建'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '分享创建失败';
    res.status(400).json(fail(msg));
  }
}

export async function getShare(req: Request, res: Response) {
  try {
    const code = typeof req.params.code === 'string' ? req.params.code : '';
    if (!code || !/^[A-Za-z0-9_-]{8,32}$/.test(code)) {
      res.status(400).json(fail('无效的分享码'));
      return;
    }
    const data = await AuxModel.getShareByCode(code);
    if (!data) { res.status(404).json(fail('分享不存在')); return; }
    res.set('Cache-Control', 'private, no-store');
    res.json(success(data));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '获取分享失败';
    res.status(500).json(fail(msg));
  }
}

export async function deleteShare(req: Request, res: Response) {
  try {
    const code = typeof req.params.code === 'string' ? req.params.code : '';
    if (!code || !/^[A-Za-z0-9_-]{8,32}$/.test(code)) {
      res.status(400).json(fail('分享码无效'));
      return;
    }
    const deleted = await AuxModel.deleteShare(req.userId!, code);
    if (!deleted) {
      res.status(404).json(fail('分享不存在或无权撤销'));
      return;
    }
    res.json(success(null, '分享链接已撤销'));
  } catch (err: unknown) {
    res.status(500).json(fail('撤销分享失败'));
  }
}

export async function getMyShares(req: Request, res: Response) {
  try {
    const shares = await AuxModel.getUserShares(req.userId!);
    res.json(success(shares));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '获取分享列表失败';
    res.status(500).json(fail(msg));
  }
}
