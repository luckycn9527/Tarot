import { astro } from 'iztro'

/** 单颗星曜的精简表示 */
export interface ZiweiStar {
  name: string
  /** 亮度：庙/旺/得/利/平/不/陷 等，可能为空 */
  brightness: string
  /** 四化：禄/权/科/忌，无则为空 */
  mutagen: string
}

/** 单个宫位的精简表示 */
export interface ZiweiPalace {
  index: number
  name: string
  heavenlyStem: string
  earthlyBranch: string
  isBodyPalace: boolean
  isSoulPalace: boolean
  majorStars: ZiweiStar[]
  minorStars: ZiweiStar[]
}

/** 归一化后的紫微斗数星盘 */
export interface ZiweiChart {
  solarDate: string
  lunarDate: string
  chineseDate: string
  time: string
  timeRange: string
  zodiac: string
  sign: string
  /** 五行局，如「火六局」 */
  fiveElementsClass: string
  /** 命主 */
  soul: string
  /** 身主 */
  body: string
  /** 命宫地支 */
  soulBranch: string
  /** 身宫地支 */
  bodyBranch: string
  palaces: ZiweiPalace[]
}

/**
 * 将出生「小时」转换为 iztro 的时辰索引（0=早子…11=亥…12=晚子）。
 * 子时 23:00-00:59：00:00-00:59→0（早子），23:00-23:59→12（晚子）。
 */
export function hourToTimeIndex(hour: number | null | undefined): number {
  const h = Number(hour)
  if (!Number.isFinite(h) || h < 0) return 6 // 默认午时
  if (h === 23) return 12
  return Math.floor((h + 1) / 2) % 12
}

interface RawStar {
  name?: string
  brightness?: string
  mutagen?: string
}

function mapStars(list: RawStar[] | undefined): ZiweiStar[] {
  if (!Array.isArray(list)) return []
  return list.map((s) => ({
    name: String(s?.name ?? ''),
    brightness: String(s?.brightness ?? ''),
    mutagen: String(s?.mutagen ?? ''),
  }))
}

/**
 * 计算紫微斗数星盘。
 * @param solarDate 阳历日期 YYYY-MM-DD
 * @param hour 出生小时（0-23）
 * @param gender 'male' | 'female'
 */
export function computeZiwei(
  solarDate: string,
  hour: number | null | undefined,
  gender: 'male' | 'female',
): ZiweiChart | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(solarDate)) return null
  try {
    const timeIndex = hourToTimeIndex(hour)
    const g = gender === 'female' ? '女' : '男'
    const a = astro.bySolar(solarDate, timeIndex, g, true, 'zh-CN')
    const soulBranch = String(a.earthlyBranchOfSoulPalace)
    const palaces: ZiweiPalace[] = a.palaces.map((p) => ({
      index: Number(p.index),
      name: String(p.name),
      heavenlyStem: String(p.heavenlyStem),
      earthlyBranch: String(p.earthlyBranch),
      isBodyPalace: Boolean(p.isBodyPalace),
      isSoulPalace: String(p.name) === '命宫',
      majorStars: mapStars(p.majorStars as RawStar[]),
      minorStars: mapStars(p.minorStars as RawStar[]),
    }))
    return {
      solarDate: String(a.solarDate),
      lunarDate: String(a.lunarDate),
      chineseDate: String(a.chineseDate),
      time: String(a.time),
      timeRange: String(a.timeRange),
      zodiac: String(a.zodiac),
      sign: String(a.sign),
      fiveElementsClass: String(a.fiveElementsClass),
      soul: String(a.soul),
      body: String(a.body),
      soulBranch,
      bodyBranch: String(a.earthlyBranchOfBodyPalace),
      palaces,
    }
  } catch {
    return null
  }
}

/**
 * 传统紫微命盘 4×4 棋盘布局：地支 → 网格坐标（row, col，1-based）。
 *   巳 午 未 申
 *   辰 ▦  ▦ 酉
 *   卯 ▦  ▦ 戌
 *   寅 丑 子 亥
 */
export const ZIWEI_GRID_POS: Record<string, { row: number; col: number }> = {
  巳: { row: 1, col: 1 }, 午: { row: 1, col: 2 }, 未: { row: 1, col: 3 }, 申: { row: 1, col: 4 },
  辰: { row: 2, col: 1 }, 酉: { row: 2, col: 4 },
  卯: { row: 3, col: 1 }, 戌: { row: 3, col: 4 },
  寅: { row: 4, col: 1 }, 丑: { row: 4, col: 2 }, 子: { row: 4, col: 3 }, 亥: { row: 4, col: 4 },
}
