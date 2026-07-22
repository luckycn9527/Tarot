import { Router } from 'express';
import * as InvitationController from '../controllers/invitation.controller.js';
import { auth } from '../middleware/auth.js';
import { invitationRedeemLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/redeem', auth, invitationRedeemLimiter, InvitationController.redeem);

export default router;
