import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

declare global {
  namespace Express {
    interface Request {
      /** 由 validateQuery 写入 */
      validatedQuery?: unknown;
    }
  }
}

function flattenQuery(query: Request['query']): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(flattenQuery(req.query));
    if (!result.success) {
      next(result.error);
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}
