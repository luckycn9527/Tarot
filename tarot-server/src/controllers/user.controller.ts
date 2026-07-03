import type { Request, Response } from 'express';
import * as UserService from '../services/user.service.js';
import { success, fail } from '../utils/response.js';
import { storeUploadedImage } from '../utils/imageUpload.js';

function getErrMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function getProfile(req: Request, res: Response) {
  try {
    const profile = await UserService.getProfile(req.userId!);
    res.json(success(profile));
  } catch (err: unknown) {
    res.status(404).json(fail(getErrMsg(err, '用户不存在')));
  }
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const profile = await UserService.updateProfile(req.userId!, req.body);
    res.json(success(profile, '资料更新成功'));
  } catch (err: unknown) {
    res.status(400).json(fail(getErrMsg(err, '资料更新失败')));
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const { oldPassword, newPassword } = req.body;
    await UserService.changePassword(req.userId!, oldPassword, newPassword);
    res.json(success(null, '密码修改成功'));
  } catch (err: unknown) {
    res.status(400).json(fail(getErrMsg(err, '密码修改失败')));
  }
}

export async function getQuota(req: Request, res: Response) {
  try {
    const quota = await UserService.getQuota(req.userId!);
    res.json(success(quota));
  } catch (err: unknown) {
    res.status(404).json(fail(getErrMsg(err, '获取配额失败')));
  }
}

export async function getSettings(req: Request, res: Response) {
  try {
    const settings = await UserService.getSettings(req.userId!);
    res.json(success(settings));
  } catch (err: unknown) {
    res.status(404).json(fail(getErrMsg(err, '获取设置失败')));
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    const { cardBack, cardBackCode, settings } = req.body;
    const code = cardBackCode || cardBack;
    const result = await UserService.updateSettings(req.userId!, code, settings);
    res.json(success(result, '设置已保存'));
  } catch (err: unknown) {
    res.status(400).json(fail(getErrMsg(err, '设置保存失败')));
  }
}

export async function uploadAvatar(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json(fail('请选择头像文件'));
    }
    const image = await storeUploadedImage(req.file, {
      folder: 'avatars',
      prefix: 'avatar',
      maxDimension: 512,
      quality: 84,
    });
    const profile = await UserService.updateProfile(req.userId!, { avatar: image.publicUrl });
    res.json(success(profile, '头像上传成功'));
  } catch (err: unknown) {
    res.status(400).json(fail(getErrMsg(err, '头像上传失败')));
  }
}

export async function getBirthInfo(req: Request, res: Response) {
  try {
    const data = await UserService.getBirthInfo(req.userId!);
    res.json(success(data));
  } catch (err: unknown) {
    res.status(404).json(fail(getErrMsg(err, '用户不存在')));
  }
}

export async function updateBirthInfo(req: Request, res: Response) {
  try {
    const { birthday } = req.body;
    const data = await UserService.updateBirthInfo(req.userId!, birthday);
    res.json(success(data, '生辰信息更新成功'));
  } catch (err: unknown) {
    const status = (err as any)?.status === 400 ? 400 : 404;
    res.status(status).json(fail(getErrMsg(err, '生辰信息更新失败')));
  }
}

export async function activateVip(req: Request, res: Response) {
  // 付费功能暂未开放，直接返回敬请期待
  void req.body;
  res.status(503).json(fail('支付功能即将上线，敬请期待', { code: 'payment_not_available' }));
}
