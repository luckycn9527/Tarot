import type { Request, Response, NextFunction } from 'express';
import * as History from '../models/configHistory.model.js';
import { ApiError } from '../utils/apiError.js';
import { adminSafeServerMessage } from '../utils/adminHttp.js';
import { success } from '../utils/response.js';
import type { ConfigScope } from '../utils/configHistory.js';
import { invalidateReferenceCore } from './reference.controller.js';

function id(req: Request) {
  const value = Number(req.params.id);
  if (!Number.isSafeInteger(value) || value < 1) throw new ApiError(400, '无效的配置版本 ID');
  return value;
}
export function configError(next: NextFunction, error: unknown, fallback = '配置操作失败') {
  next(error instanceof ApiError ? error : new ApiError(500, adminSafeServerMessage(error, fallback)));
}
export async function list(req: Request, res: Response, next: NextFunction) {
  try { res.json(success(await History.listConfigHistory(req.validatedQuery as { scope?: ConfigScope; page: number; pageSize: number }))); }
  catch (error) { configError(next, error); }
}
export async function detail(req: Request, res: Response, next: NextFunction) {
  try { res.json(success(await History.configVersionDetail(id(req)))); }
  catch (error) { configError(next, error); }
}
export async function preview(req: Request, res: Response, next: NextFunction) {
  try { res.json(success(await History.previewConfigRollback(id(req)))); }
  catch (error) { configError(next, error); }
}
export async function rollback(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await History.rollbackConfig(id(req), req.adminId!, req.body);
    if (result.changed) invalidateReferenceCore();
    res.json(success(result, result.changed ? '配置已回滚并生成新记录' : '当前配置与目标版本一致'));
  } catch (error) { configError(next, error); }
}
