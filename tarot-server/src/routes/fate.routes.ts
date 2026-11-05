import { Router } from 'express';
import * as FateController from '../controllers/fate.controller.js';
import { auth } from '../middleware/auth.js';
import { aiGuard } from '../middleware/aiGuard.js';
import { fateDualQuotaGuard } from '../middleware/quotaGuard.js';

const router = Router();

router.post('/analyze', auth, aiGuard, fateDualQuotaGuard, FateController.analyze);
router.post('/choose', auth, aiGuard, FateController.choose);
router.get('/history', auth, FateController.history);

export default router;
