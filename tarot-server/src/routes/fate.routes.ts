import { Router } from 'express';
import * as FateController from '../controllers/fate.controller.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.post('/analyze', auth, FateController.analyze);
router.post('/choose', auth, FateController.choose);
router.get('/history', auth, FateController.history);

export default router;
