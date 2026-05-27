import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      /** 全链路请求标识：来自 `X-Request-Id`（合法时）或新生成的 UUID */
      requestId?: string;
    }
  }
}

const INCOMING_ID = /^[\w-]{1,128}$/;

/**
 * 为每个请求分配 `requestId`，并回写 `X-Request-Id` 响应头，便于日志与客户端排障对齐。
 */
export function assignRequestId(req: Request, res: Response, next: NextFunction): void {
  const headerVal = req.get('X-Request-Id')?.trim();
  const id = headerVal && INCOMING_ID.test(headerVal) ? headerVal : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
