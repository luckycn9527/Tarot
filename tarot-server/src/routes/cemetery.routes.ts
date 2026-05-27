import { Router } from 'express';
import * as CemeteryController from '../controllers/cemetery.controller.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// 公开接口
router.get('/markers', CemeteryController.getMarkers);
router.get('/position-check', CemeteryController.checkPosition);

// 认证接口 — /tombstones/me 必须在 /tombstones/:id 之前
router.get('/tombstones/me', auth, CemeteryController.getMyTombstone);
router.get('/tombstones/:id', CemeteryController.getTombstoneById);

router.post('/divination', auth, CemeteryController.performDivination);
router.post('/tombstones', auth, CemeteryController.createTombstone);
router.put('/tombstones/me', auth, CemeteryController.updateMyTombstone);
router.delete('/tombstones/me', auth, CemeteryController.deleteMyTombstone);

export default router;
