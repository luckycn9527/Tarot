/**
 * 把数据库 DATE 列（mysql2 解析为「本地零点」的 Date 对象）规范化为 'YYYY-MM-DD'。
 *
 * 直接对该 Date 调用 toISOString() 会按 UTC 回退一天（如 +08:00 下 1995-08-15 → 1995-08-14T16:00Z），
 * 导致前端预填生日 / 计算星座出现 -1 天偏差。此处用本地年月日分量还原，
 * 与 mysql2 构造 Date 时使用的本地时区一致，因而在任意时区机器上都能正确还原。
 */
export function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = `${value.getMonth() + 1}`.padStart(2, '0');
    const d = `${value.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}
