import type { Request, Response } from 'express';
import * as AuxModel from '../models/auxiliary.model.js';
import { success, fail } from '../utils/response.js';

export async function redeem(req: Request, res: Response) {
  try {
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{4,50}$/.test(code.trim())) {
      res.status(400).json(fail('兑换码格式无效', { code: 'INVITATION_FORMAT_INVALID' }));
      return;
    }
    const result = await AuxModel.redeemCode(req.userId!, code.trim());
    res.json(success(result, result.message));
  } catch (err: unknown) {
    if (err instanceof AuxModel.InvitationRedemptionError) {
      res.status(400).json(fail(err.message, { code: err.code }));
      return;
    }
    res.status(500).json(fail('兑换失败，请稍后重试'));
  }
}
