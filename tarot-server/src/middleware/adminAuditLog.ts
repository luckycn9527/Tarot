import type { NextFunction, Request, Response } from 'express';

/**
 * 管理端写操作审计：响应结束后打一行 JSON（不含请求 body，避免记录密码或大段提示词）。
 * 须放在 adminAuth 之后，以便 req.adminId 可用。
 */
export function adminAuditLog(req: Request, res: Response, next: NextFunction): void {
  const adminId = req.adminId;
  const started = Date.now();
  const path = (req.originalUrl ?? `${req.baseUrl}${req.path}`).split('?')[0];
  const params = req.params && Object.keys(req.params).length > 0 ? { ...req.params } : undefined;

  res.on('finish', () => {
    const line = {
      ts: new Date().toISOString(),
      level: 'info',
      event: 'admin_audit',
      requestId: req.requestId ?? null,
      adminId: adminId ?? null,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Date.now() - started,
      params,
      clientIp: req.ip,
    };
    console.log(JSON.stringify(line));
  });

  next();
}
