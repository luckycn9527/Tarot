import { Router } from 'express';
import * as ReadingController from '../controllers/reading.controller.js';
import { auth } from '../middleware/auth.js';
import { quotaGuard } from '../middleware/quotaGuard.js';

const router = Router();

router.post('/single-card', auth, quotaGuard, ReadingController.singleCard);
router.post('/three-card', auth, quotaGuard, ReadingController.threeCard);
router.post('/reader-reading', auth, quotaGuard, ReadingController.readerReading);
router.post('/daily-fortune', auth, ReadingController.dailyFortune);
router.get('/history', auth, ReadingController.getHistory);
router.delete('/history/:id', auth, ReadingController.deleteHistory);

export default router;
