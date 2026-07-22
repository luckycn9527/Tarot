import type { Request, Response } from 'express';
import { fail, success } from '../utils/response.js';
import * as PaymentService from '../services/payment.service.js';
import type { PaymentPlanCode } from '../models/payment.model.js';
import * as UserModel from '../models/user.model.js';

export function getPlans(_req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  res.json(success(PaymentService.getPublicPaymentPlans()));
}

export async function createCheckout(req: Request, res: Response) {
  try {
    const user = await UserModel.findById(req.userId!);
    if (!user) {
      res.status(401).json(fail('请先登录'));
      return;
    }
    const { planCode } = req.body as { planCode: PaymentPlanCode };
    const data = await PaymentService.createCheckout({ id: user.id, email: user.email }, planCode);
    res.json(success(data));
  } catch (error) {
    const status = error instanceof PaymentService.PaymentError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : '创建支付订单失败';
    res.status(status).json(fail(message));
  }
}

export async function getSubscription(req: Request, res: Response) {
  try {
    res.json(success(await PaymentService.getSubscription(req.userId!)));
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取订阅状态失败';
    res.status(500).json(fail(message));
  }
}

export async function cancelSubscription(req: Request, res: Response) {
  try {
    res.json(success(await PaymentService.cancelSubscription(req.userId!), '已取消自动续费，权益将保留至当前周期结束'));
  } catch (error) {
    const status = error instanceof PaymentService.PaymentError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : '取消自动续费失败';
    res.status(status).json(fail(message));
  }
}

export async function webhook(req: Request, res: Response) {
  try {
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json(fail('Webhook 请求体格式无效'));
      return;
    }
    await PaymentService.processWebhook(req.body, req.header('creem-signature') ?? undefined);
    res.json(success(null));
  } catch (error) {
    const status = error instanceof PaymentService.PaymentError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Webhook 处理失败';
    res.status(status).json(fail(message));
  }
}
