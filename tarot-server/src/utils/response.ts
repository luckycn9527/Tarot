/** 与 errorHandler 中 Zod 分支一致，便于前端按 code 分支 */
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR' as const;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  /** 业务/校验错误码，如 VALIDATION_ERROR */
  code?: string;
  /** 结构化说明，如 Zod flatten 结果 */
  details?: unknown;
}

export function success<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message };
}

export function fail(
  message: string,
  meta?: { code?: string; details?: unknown },
): ApiResponse {
  const out: ApiResponse = { success: false, message };
  if (meta?.code != null) out.code = meta.code;
  if (meta?.details !== undefined) out.details = meta.details;
  return out;
}
