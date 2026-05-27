import { Router } from 'express';
import * as FeedbackController from '../controllers/feedback.controller.js';
import { optionalAuth } from '../middleware/optionalAuth.js';

const router = Router();

router.post('/', optionalAuth, FeedbackController.submitFeedback);

export default router;
