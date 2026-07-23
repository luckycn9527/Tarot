import { Router } from 'express';
import * as ReadingController from '../controllers/reading.controller.js';
import { auth } from '../middleware/auth.js';
import { aiGuard } from '../middleware/aiGuard.js';
import { quotaGuard } from '../middleware/quotaGuard.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  dailyFortuneSchema,
  historyQuerySchema,
  horoscopeQuerySchema,
  readerFollowupSchema,
  readerReadingSchema,
  readingOutcomeSchema,
  singleCardSchema,
  threeCardSchema,
} from '../schemas/reading.schema.js';

const router = Router();

router.post('/single-card', auth, validate(singleCardSchema), aiGuard, quotaGuard, ReadingController.singleCard);
router.post('/three-card', auth, validate(threeCardSchema), aiGuard, quotaGuard, ReadingController.threeCard);
router.post('/reader-reading', auth, validate(readerReadingSchema), aiGuard, quotaGuard, ReadingController.readerReading);
router.post('/reader-followup', auth, validate(readerFollowupSchema), aiGuard, quotaGuard, ReadingController.readerFollowup);
router.post('/daily-fortune', auth, validate(dailyFortuneSchema), aiGuard, quotaGuard, ReadingController.dailyFortune);
router.get('/horoscope', auth, validateQuery(horoscopeQuerySchema), aiGuard, ReadingController.horoscope);
router.get('/history', auth, validateQuery(historyQuerySchema), ReadingController.getHistory);
router.get('/insights', auth, aiGuard, ReadingController.getInsights);
router.delete('/history/:id', auth, ReadingController.deleteHistory);
router.post('/history/:id/outcome', auth, validate(readingOutcomeSchema), ReadingController.setOutcome);

export default router;
