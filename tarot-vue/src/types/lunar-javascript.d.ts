declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(y: number, m: number, d: number): Solar
    static fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): Solar
    getLunar(): Lunar
    getXingZuo(): string
  }

  export class Lunar {
    toString(): string
    getEightChar(): EightChar
    getYearInChinese(): string
    getMonthInChinese(): string
    getDayInChinese(): string
  }

  export class EightChar {
    getYear(): string
    getMonth(): string
    getDay(): string
    getTime(): string
  }
}
