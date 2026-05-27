import { Router } from 'express';
import * as ShareController from '../controllers/share.controller.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.post('/', auth, ShareController.createShare);
router.get('/mine', auth, ShareController.getMyShares);
router.get('/:code', ShareController.getShare);

export default router;
