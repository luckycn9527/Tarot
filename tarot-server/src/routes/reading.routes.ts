import { Router } from 'express';
import * as ReadingController from '../controllers/reading.controller.js';
import { auth } from '../middleware/auth.js';
import { quotaGuard } from '../middleware/quotaGuard.js';

const router = Router();

router.post('/single-card', auth, quotaGuard, ReadingController.singleCard);
router.post('/three-card', auth, quotaGuard, ReadingController.threeCard);
router.post('/reader-reading', auth, quotaGuard, ReadingController.readerReading);
router.post('/reader-followup', auth, ReadingController.readerFollowup);
router.post('/daily-fortune', auth, ReadingController.dailyFortune);
router.get('/horoscope', ReadingController.horoscope);
router.get('/history', auth, ReadingController.getHistory);
router.get('/insights', auth, ReadingController.getInsights);
router.delete('/history/:id', auth, ReadingController.deleteHistory);
router.post('/history/:id/outcome', auth, ReadingController.setOutcome);

export default router;
