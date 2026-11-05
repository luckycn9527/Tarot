import type { Request, Response, NextFunction } from 'express';

export interface SavedSingleReading {
  question: string;
  cardId: number;
  orientation: string;
  response: unknown;
}

interface RetryDependencies {
  find(userId: number, requestId: string): Promise<SavedSingleReading | null>;
  acquire(key: string): Promise<(() => void | Promise<void>) | null>;
}

/** Replay persisted successes before quota checks; keep in-flight work locked
 * even when the browser disconnects before the AI response arrives. */
export function createSingleReadingRetry({ find, acquire }: RetryDependencies) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.body.requestId as string | undefined;
    if (!requestId) { next(); return; }
    const replay = (saved: SavedSingleReading | null) => {
      if (!saved) return false;
      if (saved.question !== req.body.question || saved.cardId !== req.body.cardId
        || saved.orientation !== req.body.orientation) {
        res.status(409).json({ success: false, message: '该请求标识已用于另一条占卜，请重新开始' });
      } else {
        res.json({ success: true, data: saved.response });
      }
      return true;
    };
    try {
      res.setHeader('Cache-Control', 'no-store');
      if (replay(await find(req.userId!, requestId))) return;
      const release = await acquire(`${req.userId}:${requestId}`);
      if (!release) {
        res.setHeader('Retry-After', '2');
        res.status(409).json({ success: false, message: '解读仍在生成，请稍后使用当前牌面重试' });
        return;
      }
      let released = false;
      const releaseOnce = () => {
        if (released) return;
        released = true;
        void Promise.resolve().then(release).catch(() => { /* lease expires */ });
      };
      const json = res.json;
      res.json = function (body) {
        try { return json.call(this, body); }
        finally { releaseOnce(); }
      };
      res.once('finish', releaseOnce);
      try {
        // Close the race between the initial lookup and acquiring the lease.
        if (!replay(await find(req.userId!, requestId))) next();
      } catch (error) {
        releaseOnce();
        next(error);
      }
    } catch (error) {
      next(error);
    }
  };
}
