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
  membership_restore_expires_at: string | null;
  membership_granted_until: string | null;
  access_revoked_at: string | null;
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
  if (input.orderId) {
    const byOrderId = rows.find((row) => row.id === input.orderId);
    if (byOrderId) return byOrderId;
  }
  if (input.checkoutId) {
    const byCheckoutId = rows.find((row) => row.provider_checkout_id === input.checkoutId);
    if (byCheckoutId) return byCheckoutId;
  }
  if (input.subscriptionId) {
    const bySubscriptionId = rows.find((row) => row.provider_subscription_id === input.subscriptionId);
    if (bySubscriptionId) return bySubscriptionId;
  }
  return null;
}

export async function findOrderForUser(orderId: string, userId: number): Promise<PaymentOrder | null> {
  const [rows] = await pool.execute<PaymentOrder[]>(
    'SELECT * FROM payment_orders WHERE id = ? AND user_id = ? LIMIT 1',
    [orderId, userId],
  );
  return rows[0] ?? null;
}

/**
 * Atomically claim and apply a provider event. The primary key on
 * payment_events is the concurrency gate: only the connection that inserts the
 * event may mutate the order and membership state.
 */
export async function applyWebhookEvent(input: {
  providerEventId: string;
  eventType: string;
  payloadJson: string;
  orderId: string;
  userId: number;
  status: string;
  checkoutId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  currentPeriodEndAt?: Date | null;
  membershipAction: 'activate' | 'revoke' | 'none';
}): Promise<boolean> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [claim] = await connection.execute<ResultSetHeader>(
      `INSERT IGNORE INTO payment_events (provider_event_id, event_type, payload_json)
       VALUES (?, ?, ?)`,
      [input.providerEventId, input.eventType, input.payloadJson],
    );
    if (claim.affectedRows !== 1) {
      await connection.rollback();
      return false;
    }

    await connection.execute(
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

    if (input.membershipAction === 'activate' && input.currentPeriodEndAt) {
      const [orderRows] = await connection.execute<RowDataPacket[]>(
        'SELECT membership_granted_until FROM payment_orders WHERE id = ? FOR UPDATE',
        [input.orderId],
      );
      const [userRows] = await connection.execute<RowDataPacket[]>(
        'SELECT membership, membership_expires_at FROM users WHERE id = ? FOR UPDATE',
        [input.userId],
      );
      const previousGrant = orderRows[0]?.membership_granted_until
        ? new Date(orderRows[0].membership_granted_until).getTime()
        : 0;
      const currentExpiry = userRows[0]?.membership_expires_at
        ? new Date(userRows[0].membership_expires_at).getTime()
        : 0;
      const incomingExpiry = input.currentPeriodEndAt.getTime();
      const hasLifetimeAccess = userRows[0]?.membership === 'vip' && !userRows[0]?.membership_expires_at;

      if (!hasLifetimeAccess && incomingExpiry > previousGrant && incomingExpiry > currentExpiry) {
        await connection.execute(
          `UPDATE payment_orders
           SET membership_restore_expires_at = ?,
               membership_granted_until = ?,
               access_revoked_at = NULL
           WHERE id = ?`,
          [userRows[0]?.membership_expires_at ?? null, input.currentPeriodEndAt, input.orderId],
        );
        await connection.execute(
          `UPDATE users
           SET membership = 'vip',
               membership_expires_at = ?
           WHERE id = ?`,
          [input.currentPeriodEndAt, input.userId],
        );
      }
    } else if (input.membershipAction === 'revoke') {
      await connection.execute(
        `UPDATE users u
         JOIN payment_orders p ON p.id = ?
         SET u.membership = CASE
               WHEN p.membership_restore_expires_at IS NOT NULL
                 AND p.membership_restore_expires_at > NOW() THEN 'vip'
               ELSE 'free'
             END,
             u.membership_expires_at = p.membership_restore_expires_at
         WHERE u.id = ?
           AND u.membership = 'vip'
           AND u.membership_expires_at IS NOT NULL
           AND p.membership_granted_until IS NOT NULL
           AND ABS(TIMESTAMPDIFF(SECOND, u.membership_expires_at, p.membership_granted_until)) <= 1`,
        [input.orderId, input.userId],
      );
      await connection.execute(
        'UPDATE payment_orders SET access_revoked_at = NOW() WHERE id = ?',
        [input.orderId],
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findSubscriptionForUser(userId: number): Promise<PaymentOrder | null> {
  const [rows] = await pool.execute<PaymentOrder[]>(
    `SELECT * FROM payment_orders
     WHERE user_id = ?
       AND provider_subscription_id IS NOT NULL
       AND status IN ('active', 'trialing', 'past_due', 'expired_retrying', 'scheduled_cancel', 'checkout_completed', 'partially_refunded')
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
