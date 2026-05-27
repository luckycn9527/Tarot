/** 登录/注册统一规范化，避免首尾空格与大小写导致「本地能登、线上 401」 */
export function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}
