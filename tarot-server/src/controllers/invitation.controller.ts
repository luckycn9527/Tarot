import type { Request, Response } from 'express';
import * as AuxModel from '../models/auxiliary.model.js';
import { success, fail } from '../utils/response.js';

export async function redeem(req: Request, res: Response) {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json(fail('请输入邀请码')); return; }
    const result = await AuxModel.redeemCode(req.userId!, code);
    res.json(success(result, result.message));
  } catch (err: any) {
    res.status(400).json(fail(err.message));
  }
}
