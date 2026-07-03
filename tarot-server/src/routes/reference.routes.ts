import { Router } from 'express';
import * as ReferenceController from '../controllers/reference.controller.js';

const router = Router();
router.get('/core', ReferenceController.getReferenceCore);
router.get('/card-details', ReferenceController.getTarotCardDetails);
router.get('/bundle', ReferenceController.getReferenceBundle);

export default router;
