import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ApiError } from '../utils/apiError.js';
import { fail, VALIDATION_ERROR_CODE } from '../utils/response.js';

function isMulterError(err: unknown): err is multer.MulterError {
  return err instanceof multer.MulterError;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? null;

  if (err instanceof ApiError) {
    res.status(err.statusCode).json(fail(err.message));
    return;
  }
  if (err instanceof z.ZodError) {
    const flat = err.flatten();
    const fieldFirst = Object.values(flat.fieldErrors).flat().find((m) => typeof m === 'string' && m);
    const msg =
      (typeof fieldFirst === 'string' ? fieldFirst : undefined) ||
      flat.formErrors[0] ||
      '参数验证失败';
    res.status(400).json(
      fail(String(msg), {
        code: VALIDATION_ERROR_CODE,
        details: {
          fieldErrors: flat.fieldErrors,
          formErrors: flat.formErrors,
        },
      }),
    );
    return;
  }

  if (isMulterError(err)) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json(
        fail('文件大小不能超过 5MB', {
          code: VALIDATION_ERROR_CODE,
          details: { scope: 'multipart', multerCode: err.code },
        }),
      );
      return;
    }
    res.status(400).json(
      fail('上传失败：文件或字段不符合要求', {
        code: VALIDATION_ERROR_CODE,
        details: { scope: 'multipart', multerCode: err.code },
      }),
    );
    return;
  }
  if (err instanceof Error && err.message === '仅支持 JPG/PNG/GIF/WebP 图片格式') {
    res.status(400).json(
      fail(err.message, {
        code: VALIDATION_ERROR_CODE,
        details: { scope: 'multipart', reason: 'unsupported_mime' },
      }),
    );
    return;
  }

  const e = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      event: 'unhandled_error',
      requestId,
      path: (req.originalUrl ?? req.url)?.split('?')[0],
      message: e.message,
      ...(process.env.NODE_ENV === 'development' && e.stack ? { stack: e.stack } : {}),
    }),
  );
  const message =
    process.env.NODE_ENV === 'production' ? '服务器内部错误' : e.message || '服务器内部错误';
  res.status(500).json(fail(message));
}
