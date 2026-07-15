export interface TrueSolarTimeResult {
  date: string;
  time: string;
  offsetMinutes: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** 中国境内按 UTC+8（中央经线 120°E）计算真太阳时。 */
export function calculateTrueSolarTime(
  date: string,
  time: string,
  longitude: number,
): TrueSolarTimeResult | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})/.exec(time);
  if (!dateMatch || !timeMatch || !Number.isFinite(longitude)) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (longitude < 73 || longitude > 135 || hour > 23 || minute > 59) return null;

  const sourceUtc = Date.UTC(year, month - 1, day, hour, minute);
  const startOfYear = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - startOfYear) / 86_400_000);
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364;
  const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const offsetMinutes = Math.round(4 * (longitude - 120) + equationOfTime);
  const corrected = new Date(sourceUtc + offsetMinutes * 60_000);

  return {
    date: `${corrected.getUTCFullYear()}-${pad2(corrected.getUTCMonth() + 1)}-${pad2(corrected.getUTCDate())}`,
    time: `${pad2(corrected.getUTCHours())}:${pad2(corrected.getUTCMinutes())}`,
    offsetMinutes,
  };
}
