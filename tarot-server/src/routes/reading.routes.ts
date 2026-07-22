import { Router } from 'express';
import * as ReadingController from '../controllers/reading.controller.js';
import { auth } from '../middleware/auth.js';
import { aiGuard } from '../middleware/aiGuard.js';
import { quotaGuard } from '../middleware/quotaGuard.js';

const router = Router();

router.post('/single-card', auth, aiGuard, quotaGuard, ReadingController.singleCard);
router.post('/three-card', auth, aiGuard, quotaGuard, ReadingController.threeCard);
router.post('/reader-reading', auth, aiGuard, quotaGuard, ReadingController.readerReading);
router.post('/reader-followup', auth, aiGuard, quotaGuard, ReadingController.readerFollowup);
router.post('/daily-fortune', auth, aiGuard, quotaGuard, ReadingController.dailyFortune);
router.get('/horoscope', auth, aiGuard, ReadingController.horoscope);
router.get('/history', auth, ReadingController.getHistory);
router.get('/insights', auth, aiGuard, ReadingController.getInsights);
router.delete('/history/:id', auth, ReadingController.deleteHistory);
router.post('/history/:id/outcome', auth, ReadingController.setOutcome);

export default router;
