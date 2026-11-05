import { Router } from 'express';
import { z } from 'zod';
import * as PaymentController from '../controllers/payment.controller.js';
import { auth } from '../middleware/auth.js';
import { paymentCheckoutLimiter, paymentWebhookLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { env } from '../config/env.js';

export function createPaymentRouter(paymentsEnabled = env.CREEM_ENABLED) {
  const router = Router();

  // The public plan probe remains available so the frontend can render the
  // correct "not available" state without exposing database-backed endpoints.
  router.get('/plans', PaymentController.getPlans);

  if (paymentsEnabled) {
    router.get('/subscription', auth, PaymentController.getSubscription);
    router.get('/orders/:orderId', auth, PaymentController.getOrderStatus);
    router.post(
      '/checkout',
      auth,
      paymentCheckoutLimiter,
      validate(z.object({ planCode: z.enum(['vip_monthly', 'vip_yearly']) })),
      PaymentController.createCheckout,
    );
    router.post('/subscription/cancel', auth, paymentCheckoutLimiter, PaymentController.cancelSubscription);
    router.post('/webhook', paymentWebhookLimiter, PaymentController.webhook);
  }

  return router;
}

export default createPaymentRouter();
