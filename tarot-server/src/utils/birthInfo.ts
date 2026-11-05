/** Shared by both profile and birth-info writes; SQL DATE must not coerce invalid dates. */
export function assertBirthday(birthday: unknown): asserts birthday is string | null {
  if (birthday === null) return;
  if (typeof birthday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    throw Object.assign(new Error('日期格式无效，请使用 YYYY-MM-DD'), { status: 400 });
  }
  const [year, month, day] = birthday.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (month < 1 || month > 12 || day < 1 || day > 31 ||
      parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw Object.assign(new Error('日期不是合法的日历日期'), { status: 400 });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed.getTime() > today.getTime()) {
    throw Object.assign(new Error('出生日期不能晚于今天'), { status: 400 });
  }
}

export function assertBirthTime(value: unknown): asserts value is string | null | undefined {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw Object.assign(new Error('出生时刻需为 HH:mm（00:00–23:59）'), { status: 400 });
  }
}

/** mysql2 returns TIME as HH:mm:ss; the account editor works at minute precision. */
export function toBirthTime(value: unknown): string | null {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return null;
  return value.slice(0, 5);
}
