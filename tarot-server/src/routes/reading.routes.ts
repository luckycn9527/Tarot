import { Router } from 'express';
import * as ReadingController from '../controllers/reading.controller.js';
import { historyDetail } from '../services/mobileReading.service.js';
import { success } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { auth } from '../middleware/auth.js';
import { aiGuard } from '../middleware/aiGuard.js';
import { singleReadingRetry } from '../middleware/singleReadingRetry.js';
import { dailyFortuneQuotaGuard, quotaGuard } from '../middleware/quotaGuard.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  dailyFortuneSchema,
  historyQuerySchema,
  insightsQuerySchema,
  horoscopeQuerySchema,
  readerFollowupSchema,
  readerReadingSchema,
  readingOutcomeSchema,
  singleCardSchema,
  threeCardSchema,
} from '../schemas/reading.schema.js';

const router = Router();

router.post('/single-card', auth, validate(singleCardSchema), singleReadingRetry, aiGuard, quotaGuard, ReadingController.singleCard);
router.post('/three-card', auth, validate(threeCardSchema), aiGuard, quotaGuard, ReadingController.threeCard);
router.post('/reader-reading', auth, validate(readerReadingSchema), aiGuard, quotaGuard, ReadingController.readerReading);
router.post('/reader-followup', auth, validate(readerFollowupSchema), aiGuard, quotaGuard, ReadingController.readerFollowup);
router.get('/daily-fortune', auth, ReadingController.dailyFortuneCache);
router.get('/daily-fortune/yesterday', auth, ReadingController.yesterdayDailyFortuneCache);
router.post('/daily-fortune', auth, validate(dailyFortuneSchema), ReadingController.reuseDailyFortune, aiGuard, dailyFortuneQuotaGuard, ReadingController.dailyFortune);
router.get('/horoscope', auth, validateQuery(horoscopeQuerySchema), aiGuard, ReadingController.horoscope);
router.get('/history', auth, validateQuery(historyQuerySchema), ReadingController.getHistory);
router.get('/history/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, '无效的占卜记录ID');
    res.setHeader('Cache-Control', 'no-store');
    res.json(success(await historyDetail(req.userId!, id)));
  } catch (error) { next(error); }
});
router.get('/insights', auth, validateQuery(insightsQuerySchema), aiGuard, ReadingController.getInsights);
router.delete('/history/:id', auth, ReadingController.deleteHistory);
router.post('/history/:id/outcome', auth, validate(readingOutcomeSchema), ReadingController.setOutcome);

export default router;
