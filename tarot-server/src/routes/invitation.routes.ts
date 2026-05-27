import { Router } from 'express';
import * as InvitationController from '../controllers/invitation.controller.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.post('/redeem', auth, InvitationController.redeem);

export default router;
