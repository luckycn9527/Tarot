import type { NextFunction, Request, Response } from 'express';
import * as AdminService from '../services/admin.service.js';
import type { AdminListFeedbackQuery, AdminListUsersQuery } from '../validation/adminQuery.js';
import { adminSafeServerMessage } from '../utils/adminHttp.js';
import { ApiError } from '../utils/apiError.js';
import { writeReaderAvatarThumbFile } from '../utils/readerAvatarThumb.js';
import { success } from '../utils/response.js';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password } = req.body;
    const result = await AdminService.adminLogin(username, password);
    res.json(success(result, '登录成功'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : '管理员账号或密码错误';
    next(new ApiError(401, msg));
  }
}

export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.validatedQuery as AdminListUsersQuery;
    const data = await AdminService.listUsers(q.page, q.pageSize, q.keyword);
    res.json(success(data));
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId < 1) {
      next(new ApiError(400, '无效的用户 ID'));
      return;
    }
    await AdminService.updateUserByAdmin(userId, req.body);
    res.json(success(null, '更新成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '更新失败'));
  }
}

export async function getCardBacks(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await AdminService.listCardBacks();
    res.json(success(data));
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function putCardBacks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AdminService.saveCardBacks(req.body.items);
    res.json(success(null, '保存成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '保存失败'));
  }
}

export async function deleteCardBack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      next(new ApiError(400, '无效的牌背 ID'));
      return;
    }
    await AdminService.deleteCardBack(id);
    res.json(success(null, '删除成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '删除失败'));
  }
}

export async function getCards(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await AdminService.listCards();
    res.json(success(data));
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function putCards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AdminService.saveCards(req.body.items);
    res.json(success(null, '保存成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '保存失败'));
  }
}

export async function getReaderPrompts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await AdminService.listReaderPrompts();
    res.json(success(data));
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function putReaderPrompts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await AdminService.saveReaderPrompts(req.body.items);
    res.json(success(null, '保存成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '保存失败'));
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await AdminService.getStats();
    res.json(success(data));
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function listFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.validatedQuery as AdminListFeedbackQuery;
    const data = await AdminService.listFeedback(q.page, q.pageSize, q.status);
    res.json(success(data));
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function replyFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      next(new ApiError(400, '无效的反馈 ID'));
      return;
    }
    const { adminReply, status } = req.body as { adminReply: string; status: string };
    await AdminService.replyFeedback(id, adminReply, status);
    res.json(success(null, '回复成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '回复失败'));
  }
}

export async function uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      next(new ApiError(400, '请选择文件'));
      return;
    }
    const url = `/uploads/admin/${req.file.filename}`;
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    let thumbUrl: string | undefined;
    if (type === 'reader-avatar' && req.file.path) {
      const t = await writeReaderAvatarThumbFile(req.file.path, req.file.filename);
      if (t) thumbUrl = t;
    }
    res.json(success(thumbUrl ? { url, thumbUrl } : { url }, '上传成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '上传失败'));
  }
}
