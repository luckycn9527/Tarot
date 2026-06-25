import { Router } from 'express';
import * as FateController from '../controllers/fate.controller.js';
import { auth } from '../middleware/auth.js';
import { quotaGuard } from '../middleware/quotaGuard.js';

const router = Router();

router.post('/analyze', auth, quotaGuard, FateController.analyze);
router.post('/choose', auth, FateController.choose);
router.get('/history', auth, FateController.history);

export default router;
