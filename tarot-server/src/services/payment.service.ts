import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import type { PaymentPlanCode } from '../models/payment.model.js';
import * as PaymentModel from '../models/payment.model.js';

type CreemObject = Record<string, unknown>;

export class PaymentError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

interface PaymentPlan {
  code: PaymentPlanCode;
  productId: string;
  amountCents: number;
  currency: string;
}

function configuredPlans(): PaymentPlan[] {
  if (!env.CREEM_ENABLED) return [];
  return [
    {
      code: 'vip_monthly',
      productId: env.CREEM_MONTHLY_PRODUCT_ID!,
      amountCents: env.CREEM_MONTHLY_PRICE_CENTS,
      currency: env.CREEM_CURRENCY,
    },
    {
      code: 'vip_yearly',
      productId: env.CREEM_YEARLY_PRODUCT_ID!,
      amountCents: env.CREEM_YEARLY_PRICE_CENTS,
      currency: env.CREEM_CURRENCY,
    },
  ];
}

function requirePaymentConfiguration(): PaymentPlan[] {
  if (!env.CREEM_ENABLED) {
    throw new PaymentError('支付功能暂未开放', 503);
  }
  const plans = configuredPlans();
  if (!env.CREEM_API_KEY || !env.CREEM_WEBHOOK_SECRET || plans.some((plan) => !plan.productId)) {
    throw new PaymentError('支付服务配置不完整，请稍后再试', 503);
  }
  return plans;
}

function isPaymentConfigured(): boolean {
  return Boolean(
    env.CREEM_ENABLED
      && env.CREEM_API_KEY
      && env.CREEM_WEBHOOK_SECRET
      && env.CREEM_MONTHLY_PRODUCT_ID
      && env.CREEM_YEARLY_PRODUCT_ID,
  );
}

function asObject(value: unknown): CreemObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as CreemObject
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function objectId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return asString(asObject(value)?.id);
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function nestedObject(root: CreemObject, key: string): CreemObject | null {
  return asObject(root[key]);
}

function productIdFrom(root: CreemObject): string | null {
  return objectId(root.product)
    ?? objectId(nestedObject(root, 'subscription')?.product)
    ?? objectId(nestedObject(root, 'checkout')?.product)
    ?? objectId(nestedObject(root, 'order')?.product);
}

function metadataOrderId(root: CreemObject): string | null {
  const candidates = [root, nestedObject(root, 'checkout'), nestedObject(root, 'subscription')];
  for (const candidate of candidates) {
    const metadata = asObject(candidate?.metadata);
    const id = asString(metadata?.orderId);
    if (id) return id;
  }
  return null;
}

function checkoutIdFrom(root: CreemObject, eventType: string): string | null {
  return eventType === 'checkout.completed'
    ? asString(root.id)
    : objectId(root.checkout);
}

function subscriptionIdFrom(root: CreemObject, eventType: string): string | null {
  return eventType.startsWith('subscription.')
    ? asString(root.id)
    : objectId(root.subscription);
}

function customerIdFrom(root: CreemObject): string | null {
  return objectId(root.customer)
    ?? objectId(nestedObject(root, 'subscription')?.customer)
    ?? objectId(nestedObject(root, 'checkout')?.customer);
}

function periodEndFrom(root: CreemObject): Date | null {
  const subscription = nestedObject(root, 'subscription') ?? root;
  return dateValue(subscription.current_period_end_date);
}

function statusForEvent(eventType: string, root: CreemObject): string {
  if (eventType === 'checkout.completed') return 'checkout_completed';
  const status = asString(root.status);
  return status ?? eventType.replace('subscription.', '').replace('.', '_');
}

function verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !env.CREEM_WEBHOOK_SECRET) return false;
  const expected = createHmac('sha256', env.CREEM_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const provided = Buffer.from(signature.trim(), 'utf8');
  const computed = Buffer.from(expected, 'utf8');
  return provided.length === computed.length && timingSafeEqual(provided, computed);
}

export function getPublicPaymentPlans() {
  return {
    enabled: isPaymentConfigured(),
    plans: configuredPlans().map(({ code, amountCents, currency }) => ({ code, amountCents, currency })),
  };
}

export async function createCheckout(user: { id: number; email: string }, planCode: PaymentPlanCode) {
  const plan = requirePaymentConfiguration().find((item) => item.code === planCode);
  if (!plan) throw new PaymentError('无效的会员方案', 400);

  const orderId = randomUUID();
  await PaymentModel.createOrder({ id: orderId, userId: user.id, planCode, productId: plan.productId });

  const successUrl = `${env.APP_PUBLIC_ORIGIN}/membership?payment=success`;
  try {
    const response = await fetch(`${env.CREEM_API_BASE_URL}/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CREEM_API_KEY!,
      },
      body: JSON.stringify({
        request_id: orderId,
        product_id: plan.productId,
        customer: { email: user.email },
        success_url: successUrl,
        metadata: { orderId, userId: String(user.id), planCode },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => null) as CreemObject | null;
    if (!response.ok || !payload) {
      throw new Error(`Creem checkout request failed (${response.status})`);
    }
    const checkoutId = asString(payload.id);
    const checkoutUrl = asString(payload.checkout_url);
    if (!checkoutId || !checkoutUrl) throw new Error('Creem checkout response is incomplete');
    await PaymentModel.markCheckoutCreated(orderId, checkoutId);
    return { checkoutUrl };
  } catch (error) {
    await PaymentModel.markCheckoutFailed(orderId);
    console.error('[payment] failed to create Creem checkout', {
      orderId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new PaymentError('无法创建支付订单，请稍后重试', 502);
  }
}

export async function processWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
  if (!env.CREEM_ENABLED || !env.CREEM_WEBHOOK_SECRET) {
    throw new PaymentError('支付 Webhook 未启用', 503);
  }
  if (!verifySignature(rawBody, signature)) {
    throw new PaymentError('Webhook 签名无效', 401);
  }

  let payload: CreemObject;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as CreemObject;
  } catch {
    throw new PaymentError('Webhook 请求体无效', 400);
  }
  const eventId = asString(payload.id);
  const eventType = asString(payload.eventType);
  const object = asObject(payload.object);
  if (!eventId || !eventType || !object) throw new PaymentError('Webhook 事件格式无效', 400);

  if (await PaymentModel.hasWebhookEvent(eventId)) return;

  const checkoutId = checkoutIdFrom(object, eventType);
  const subscriptionId = subscriptionIdFrom(object, eventType);
  const requestId = asString(object.request_id) ?? metadataOrderId(object);
  const order = await PaymentModel.findOrder({ orderId: requestId, checkoutId, subscriptionId });
  if (!order) {
    console.warn('[payment] ignored unmatched Creem event', { eventId, eventType });
    return;
  }

  const productId = productIdFrom(object);
  if (productId && productId !== order.provider_product_id) {
    console.error('[payment] ignored product mismatch', { eventId, orderId: order.id });
    return;
  }

  const status = statusForEvent(eventType, object);
  const periodEnd = periodEndFrom(object);
  await PaymentModel.updateSubscription({
    orderId: order.id,
    status,
    checkoutId,
    subscriptionId,
    customerId: customerIdFrom(object),
    currentPeriodEndAt: periodEnd,
  });

  const activeEvents = new Set(['checkout.completed', 'subscription.active', 'subscription.paid', 'subscription.trialing']);
  if (activeEvents.has(eventType) && periodEnd) {
    await PaymentModel.activateVip(order.user_id, periodEnd);
  } else if (eventType === 'subscription.expired') {
    await PaymentModel.clearVipIfExpired(order.user_id);
  }
  // Record only after state changes succeed so a provider retry can recover from a transient failure.
  await PaymentModel.recordWebhookEvent(eventId, eventType);
}

export async function getSubscription(userId: number) {
  const order = await PaymentModel.findSubscriptionForUser(userId);
  if (!order) return null;
  return {
    planCode: order.plan_code,
    status: order.status,
    currentPeriodEndAt: order.current_period_end_at,
    canCancel: isPaymentConfigured() && order.status !== 'scheduled_cancel',
  };
}

export async function cancelSubscription(userId: number) {
  requirePaymentConfiguration();
  const order = await PaymentModel.findSubscriptionForUser(userId);
  if (!order?.provider_subscription_id) {
    throw new PaymentError('未找到可取消的自动续费订阅', 404);
  }
  if (order.status === 'scheduled_cancel') {
    return { currentPeriodEndAt: order.current_period_end_at };
  }

  try {
    const response = await fetch(
      `${env.CREEM_API_BASE_URL}/v1/subscriptions/${encodeURIComponent(order.provider_subscription_id)}/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.CREEM_API_KEY! },
        body: JSON.stringify({ mode: 'scheduled', onExecute: 'cancel' }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) throw new Error(`Creem cancellation request failed (${response.status})`);
    const payload = await response.json().catch(() => null) as CreemObject | null;
    const periodEnd = payload ? dateValue(payload.current_period_end_date) : null;
    await PaymentModel.updateSubscription({
      orderId: order.id,
      status: 'scheduled_cancel',
      currentPeriodEndAt: periodEnd,
    });
    return { currentPeriodEndAt: periodEnd ?? order.current_period_end_at };
  } catch (error) {
    console.error('[payment] failed to cancel Creem subscription', {
      orderId: order.id,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new PaymentError('取消自动续费失败，请稍后再试', 502);
  }
}
