export interface TrueSolarTimeResult {
  date: string
  time: string
  offsetMinutes: number
}

const CITY_LONGITUDES: Record<string, number> = {
  北京: 116.4074, 上海: 121.4737, 天津: 117.2008, 重庆: 106.5516,
  广州: 113.2644, 深圳: 114.0579, 成都: 104.0665, 杭州: 120.1551,
  南京: 118.7969, 武汉: 114.3054, 西安: 108.9398, 苏州: 120.5853,
  郑州: 113.6254, 长沙: 112.9388, 沈阳: 123.4315, 青岛: 120.3826,
  宁波: 121.5503, 东莞: 113.7518, 佛山: 113.1214, 合肥: 117.2272,
  济南: 117.1201, 厦门: 118.0894, 福州: 119.2965, 昆明: 102.8329,
  哈尔滨: 126.6425, 长春: 125.3235, 南昌: 115.8582, 贵阳: 106.6302,
  南宁: 108.3669, 石家庄: 114.5149, 太原: 112.5492, 兰州: 103.8343,
  海口: 110.1983, 乌鲁木齐: 87.6168, 呼和浩特: 111.7492, 银川: 106.2309,
  西宁: 101.7782, 拉萨: 91.1409, 香港: 114.1694, 澳门: 113.5439,
  台北: 121.5654,
}

export function resolveBirthLongitude(place: string): number | null {
  const normalized = place.replace(/\s+/g, '').replace(/中国|省|自治区|特别行政区/g, '')
  const entry = Object.entries(CITY_LONGITUDES).find(([city]) => normalized.includes(city))
  return entry?.[1] ?? null
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

/** 中国境内按 UTC+8（中央经线 120°E）计算真太阳时。 */
export function calculateTrueSolarTime(
  date: string,
  time: string,
  longitude: number,
): TrueSolarTimeResult | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})/.exec(time)
  if (!dateMatch || !timeMatch || !Number.isFinite(longitude)) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  if (longitude < 73 || longitude > 135 || hour > 23 || minute > 59) return null

  const sourceUtc = Date.UTC(year, month - 1, day, hour, minute)
  const startOfYear = Date.UTC(year, 0, 0)
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - startOfYear) / 86_400_000)
  const b = (2 * Math.PI * (dayOfYear - 81)) / 364
  const equationOfTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
  const offsetMinutes = Math.round(4 * (longitude - 120) + equationOfTime)
  const corrected = new Date(sourceUtc + offsetMinutes * 60_000)

  return {
    date: `${corrected.getUTCFullYear()}-${pad2(corrected.getUTCMonth() + 1)}-${pad2(corrected.getUTCDate())}`,
    time: `${pad2(corrected.getUTCHours())}:${pad2(corrected.getUTCMinutes())}`,
    offsetMinutes,
  }
}
