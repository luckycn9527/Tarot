import * as ConfigHistory from '../models/configHistory.model.js';
import { configError } from './configHistory.controller.js';
import type { NextFunction, Request, Response } from 'express';
import * as AdminService from '../services/admin.service.js';
import type { AdminListFeedbackQuery, AdminListUsersQuery, AdminUserQuestionsQuery } from '../validation/adminQuery.js';
import { adminSafeServerMessage } from '../utils/adminHttp.js';
import { ApiError } from '../utils/apiError.js';
import { storeUploadedImage } from '../utils/imageUpload.js';
import { uploadLocalPublicFileToOss } from '../utils/ossUpload.js';
import { publicUploadsToFs, writeReaderAvatarThumbFile } from '../utils/readerAvatarThumb.js';
import { success } from '../utils/response.js';
import { invalidateReferenceCore } from './reference.controller.js';

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
    const data = await AdminService.listUsers(q.page, q.pageSize, q.keyword, q.sort);
    res.json(success(data));
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function listUserQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    next(new ApiError(400, '无效的用户 ID')); return;
  }
  try {
    const data = await AdminService.listUserQuestions(userId, req.validatedQuery as AdminUserQuestionsQuery);
    if (!data) { next(new ApiError(404, '用户不存在')); return; }
    res.json(success(data));
  } catch (error) {
    next(new ApiError(500, adminSafeServerMessage(error, '查询用户问题失败')));
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

export async function listInvitationCodes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await AdminService.listInvitationCodes();
    res.json(success(data));
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询邀请码失败')));
  }
}

export async function createInvitationCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await AdminService.createInvitationCode(req.body);
    res.status(201).json(success(data, '邀请码创建成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '邀请码创建失败'));
  }
}

export async function setInvitationCodeActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      next(new ApiError(400, '无效的邀请码 ID'));
      return;
    }
    await AdminService.setInvitationCodeActive(id, req.body.isActive);
    res.json(success(null, req.body.isActive ? '邀请码已启用' : '邀请码已停用'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '邀请码状态更新失败'));
  }
}

export async function getCardBacks(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await ConfigHistory.readVersioned('card-backs', connection => AdminService.listCardBacks(connection));
    res.json({ ...success(result.data), configVersion: result.configVersion });
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function putCardBacks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await AdminService.saveCardBacks(req.body.items, req.adminId!, req.body);
    if (result.changed) invalidateReferenceCore();
    res.json(success(result, result.changed ? '保存成功' : '配置未发生变化'));
  } catch (e) {
    configError(next, e, '保存失败');
  }
}

export async function deleteCardBack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      next(new ApiError(400, '无效的牌背 ID'));
      return;
    }
    const result = await AdminService.deleteCardBack(id, req.adminId!, req.body);
    if (result.changed) invalidateReferenceCore();
    res.json(success(result, '删除成功'));
  } catch (e) {
    configError(next, e, '删除失败');
  }
}

export async function getCards(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await ConfigHistory.readVersioned('cards', connection => AdminService.listCards(connection));
    res.json({ ...success(result.data), configVersion: result.configVersion });
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function putCards(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await AdminService.saveCards(req.body.items, req.adminId!, req.body);
    if (result.changed) invalidateReferenceCore();
    res.json(success(result, result.changed ? '保存成功' : '配置未发生变化'));
  } catch (e) {
    configError(next, e, '保存失败');
  }
}

export async function getReaderPrompts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await ConfigHistory.readVersioned('readers-prompts', connection => AdminService.listReaderPrompts(connection));
    res.json({ ...success(result.data), configVersion: result.configVersion });
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function putReaderPrompts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await AdminService.saveReaderPrompts(req.body.items, req.adminId!, req.body);
    if (result.changed) invalidateReferenceCore();
    res.json(success(result, result.changed ? '保存成功' : '配置未发生变化'));
  } catch (e) {
    configError(next, e, '保存失败');
  }
}

export async function getFeaturedReaders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await ConfigHistory.readVersioned('featured-readers', connection => AdminService.listFeaturedReaders(connection));
    res.json({ ...success(result.data), configVersion: result.configVersion });
  } catch (e) {
    next(new ApiError(500, adminSafeServerMessage(e, '查询失败')));
  }
}

export async function putFeaturedReaders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await AdminService.saveFeaturedReaders(req.body.items, req.adminId!, req.body);
    if (result.changed) invalidateReferenceCore();
    res.json(success(result, result.changed ? '保存成功' : '配置未发生变化'));
  } catch (e) {
    configError(next, e, '保存失败');
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
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    const image = await storeUploadedImage(req.file, {
      folder: 'admin',
      prefix: type || 'file',
      maxDimension: type === 'reader-avatar' ? 1024 : 1600,
      quality: 86,
    });
    let thumbUrl: string | undefined;
    if (type === 'reader-avatar') {
      const t = await writeReaderAvatarThumbFile(image.absPath, image.filename);
      if (t) thumbUrl = t;
    }

    let publicUrl = image.publicUrl;
    const ossImage = await uploadLocalPublicFileToOss(image.absPath, image.publicUrl);
    if (ossImage) publicUrl = ossImage.url;

    if (thumbUrl) {
      const thumbAbsPath = publicUploadsToFs(thumbUrl);
      if (thumbAbsPath) {
        const ossThumb = await uploadLocalPublicFileToOss(thumbAbsPath, thumbUrl);
        if (ossThumb) thumbUrl = ossThumb.url;
      }
    }

    res.json(success(thumbUrl ? { url: publicUrl, thumbUrl } : { url: publicUrl }, '上传成功'));
  } catch (e) {
    next(new ApiError(400, e instanceof Error ? e.message : '上传失败'));
  }
}
