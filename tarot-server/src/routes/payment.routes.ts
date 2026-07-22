import { Router } from 'express';
import { z } from 'zod';
import * as PaymentController from '../controllers/payment.controller.js';
import { auth } from '../middleware/auth.js';
import { paymentCheckoutLimiter, paymentWebhookLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get('/plans', PaymentController.getPlans);
router.get('/subscription', auth, PaymentController.getSubscription);
router.post(
  '/checkout',
  auth,
  paymentCheckoutLimiter,
  validate(z.object({ planCode: z.enum(['vip_monthly', 'vip_yearly']) })),
  PaymentController.createCheckout,
);
router.post('/subscription/cancel', auth, paymentCheckoutLimiter, PaymentController.cancelSubscription);
router.post('/webhook', paymentWebhookLimiter, PaymentController.webhook);

export default router;
