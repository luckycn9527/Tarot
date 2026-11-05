import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { mobileReadingSchema, mobileFollowupSchema, mobileRequestId } from '../schemas/mobile.schema.js';
import * as Mobile from '../services/mobileReading.service.js';
import { success } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); }, auth);
function send(res: Response, task: Mobile.MobileTask) {
  if (task.status === 'running') res.setHeader('Retry-After', '5');
  res.status(task.status === 'running' ? 202 : 200).json(success(task));
}
const submit = (kind: 'reading' | 'followup') => async (req: Request, res: Response, next: NextFunction) => {
  try { send(res, await Mobile.submit(req.userId!, kind, req.body)); }
  catch (error) { next(error); }
};
router.post('/readings', validate(mobileReadingSchema), submit('reading'));
router.post('/followups', validate(mobileFollowupSchema), submit('followup'));
router.get('/requests/:requestId', async (req, res, next) => {
  try { send(res, await Mobile.status(req.userId!, mobileRequestId.parse(req.params.requestId))); }
  catch (error) { next(error); }
});
router.get('/history/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(400, '无效的占卜记录ID');
    res.json(success(await Mobile.historyDetail(req.userId!, id)));
  } catch (error) { next(error); }
});
export default router;
