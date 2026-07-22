import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/database.js';

export type PaymentPlanCode = 'vip_monthly' | 'vip_yearly';

export interface PaymentOrder extends RowDataPacket {
  id: string;
  user_id: number;
  plan_code: PaymentPlanCode;
  provider_product_id: string;
  provider_checkout_id: string | null;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
  status: string;
  current_period_end_at: string | null;
}

export async function createOrder(input: {
  id: string;
  userId: number;
  planCode: PaymentPlanCode;
  productId: string;
}): Promise<void> {
  await pool.execute(
    `INSERT INTO payment_orders (id, user_id, plan_code, provider_product_id)
     VALUES (?, ?, ?, ?)`,
    [input.id, input.userId, input.planCode, input.productId],
  );
}

export async function markCheckoutCreated(orderId: string, checkoutId: string): Promise<void> {
  await pool.execute(
    `UPDATE payment_orders SET provider_checkout_id = ?, status = 'pending'
     WHERE id = ?`,
    [checkoutId, orderId],
  );
}

export async function markCheckoutFailed(orderId: string): Promise<void> {
  await pool.execute(
    `UPDATE payment_orders SET status = 'failed' WHERE id = ? AND status = 'created'`,
    [orderId],
  );
}

export async function findOrder(input: {
  orderId?: string | null;
  checkoutId?: string | null;
  subscriptionId?: string | null;
}): Promise<PaymentOrder | null> {
  const clauses: string[] = [];
  const values: string[] = [];
  if (input.orderId) {
    clauses.push('id = ?');
    values.push(input.orderId);
  }
  if (input.checkoutId) {
    clauses.push('provider_checkout_id = ?');
    values.push(input.checkoutId);
  }
  if (input.subscriptionId) {
    clauses.push('provider_subscription_id = ?');
    values.push(input.subscriptionId);
  }
  if (clauses.length === 0) return null;
  const [rows] = await pool.execute<PaymentOrder[]>(
    `SELECT * FROM payment_orders WHERE ${clauses.join(' OR ')}`,
    values,
  );
  return rows.find((row) => (
    (!input.orderId || row.id === input.orderId)
    && (!input.checkoutId || row.provider_checkout_id === input.checkoutId)
    && (!input.subscriptionId || row.provider_subscription_id === input.subscriptionId)
  )) ?? null;
}

export async function recordWebhookEvent(
  providerEventId: string,
  eventType: string,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT IGNORE INTO payment_events (provider_event_id, event_type, payload_json)
     VALUES (?, ?, ?)`,
    [providerEventId, eventType, '{}'],
  );
  return result.affectedRows === 1;
}

export async function hasWebhookEvent(providerEventId: string): Promise<boolean> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM payment_events WHERE provider_event_id = ? LIMIT 1',
    [providerEventId],
  );
  return rows.length > 0;
}

export async function findSubscriptionForUser(userId: number): Promise<PaymentOrder | null> {
  const [rows] = await pool.execute<PaymentOrder[]>(
    `SELECT * FROM payment_orders
     WHERE user_id = ?
       AND provider_subscription_id IS NOT NULL
       AND status IN ('active', 'trialing', 'past_due', 'scheduled_cancel', 'checkout_completed')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function updateSubscription(input: {
  orderId: string;
  status: string;
  checkoutId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  currentPeriodEndAt?: Date | null;
}): Promise<void> {
  await pool.execute(
    `UPDATE payment_orders
     SET status = ?,
         provider_checkout_id = COALESCE(?, provider_checkout_id),
         provider_subscription_id = COALESCE(?, provider_subscription_id),
         provider_customer_id = COALESCE(?, provider_customer_id),
         current_period_end_at = COALESCE(?, current_period_end_at)
     WHERE id = ?`,
    [
      input.status,
      input.checkoutId ?? null,
      input.subscriptionId ?? null,
      input.customerId ?? null,
      input.currentPeriodEndAt ?? null,
      input.orderId,
    ],
  );
}

export async function activateVip(userId: number, periodEnd: Date): Promise<void> {
  await pool.execute(
    `UPDATE users
     SET membership = 'vip',
         membership_expires_at = GREATEST(COALESCE(membership_expires_at, NOW()), ?)
     WHERE id = ?`,
    [periodEnd, userId],
  );
}

export async function clearVipIfExpired(userId: number): Promise<void> {
  await pool.execute(
    `UPDATE users
     SET membership = 'free'
     WHERE id = ?
       AND membership = 'vip'
       AND membership_expires_at IS NOT NULL
       AND membership_expires_at <= NOW()`,
    [userId],
  );
}
