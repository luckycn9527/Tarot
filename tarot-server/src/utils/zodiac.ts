const zodiacSigns: { sign: string; startMonth: number; startDay: number; endMonth: number; endDay: number }[] = [
  { sign: '摩羯座', startMonth: 12, startDay: 22, endMonth: 1, endDay: 19 },
  { sign: '水瓶座', startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
  { sign: '双鱼座', startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
  { sign: '白羊座', startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
  { sign: '金牛座', startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
  { sign: '双子座', startMonth: 5, startDay: 21, endMonth: 6, endDay: 21 },
  { sign: '巨蟹座', startMonth: 6, startDay: 22, endMonth: 7, endDay: 22 },
  { sign: '狮子座', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
  { sign: '处女座', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
  { sign: '天秤座', startMonth: 9, startDay: 23, endMonth: 10, endDay: 23 },
  { sign: '天蝎座', startMonth: 10, startDay: 24, endMonth: 11, endDay: 22 },
  { sign: '射手座', startMonth: 11, startDay: 23, endMonth: 12, endDay: 21 },
];

export function getZodiacSign(month: number, day: number): string {
  for (const z of zodiacSigns) {
    if (z.startMonth === z.endMonth) continue;
    if (z.startMonth > z.endMonth) {
      // 摩羯座跨年
      if ((month === z.startMonth && day >= z.startDay) || (month === z.endMonth && day <= z.endDay)) {
        return z.sign;
      }
    } else {
      if ((month === z.startMonth && day >= z.startDay) || (month === z.endMonth && day <= z.endDay)) {
        return z.sign;
      }
    }
  }
  return '';
}

export function getZodiacFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  return getZodiacSign(d.getMonth() + 1, d.getDate());
}
