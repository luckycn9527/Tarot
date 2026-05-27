import type { Request, Response } from 'express';
import * as AuxModel from '../models/auxiliary.model.js';
import { success, fail } from '../utils/response.js';

const VALID_FEEDBACK_TYPES = ['bug', 'feature', 'other', 'complaint', 'suggestion'];

export async function submitFeedback(req: Request, res: Response) {
  try {
    const { type, content, contact } = req.body;
    if (!content || typeof content !== 'string' || content.length < 5 || content.length > 2000) {
      res.status(400).json(fail('反馈内容应在5-2000字之间'));
      return;
    }
    const feedbackType = (type && VALID_FEEDBACK_TYPES.includes(type)) ? type : 'other';
    if (contact && (typeof contact !== 'string' || contact.length > 100)) {
      res.status(400).json(fail('联系方式不能超过100个字符'));
      return;
    }
    await AuxModel.createFeedback({
      userId: req.userId,
      type: feedbackType,
      content,
      contact: contact || undefined,
    });
    res.json(success(null, '感谢您的反馈'));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '反馈提交失败';
    res.status(500).json(fail(msg));
  }
}
