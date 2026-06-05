import { ref } from 'vue'
import { LegacyKeys, StorageKeys, storageGetJson, storageRemoveRawAndLegacy, storageSetJson } from '@/utils/storage'

interface ZodiacSign {
  name: string
  endMonth: number
  endDay: number
}

const ZODIAC_SIGNS: ZodiacSign[] = [
  { name: '摩羯', endMonth: 1, endDay: 19 },
  { name: '水瓶', endMonth: 2, endDay: 18 },
  { name: '双鱼', endMonth: 3, endDay: 20 },
  { name: '白羊', endMonth: 4, endDay: 19 },
  { name: '金牛', endMonth: 5, endDay: 20 },
  { name: '双子', endMonth: 6, endDay: 21 },
  { name: '巨蟹', endMonth: 7, endDay: 22 },
  { name: '狮子', endMonth: 8, endDay: 22 },
  { name: '处女', endMonth: 9, endDay: 22 },
  { name: '天秤', endMonth: 10, endDay: 23 },
  { name: '天蝎', endMonth: 11, endDay: 22 },
  { name: '射手', endMonth: 12, endDay: 21 },
  { name: '摩羯', endMonth: 12, endDay: 31 },
]

export function calculateZodiac(month: number, day: number): string {
  for (const sign of ZODIAC_SIGNS) {
    if (month < sign.endMonth || (month === sign.endMonth && day <= sign.endDay)) {
      return sign.name
    }
  }
  return '摩羯'
}

export function useZodiac() {
  const birthYear = ref('')
  const birthMonth = ref('')
  const birthDay = ref('')
  const zodiacSign = ref('')

  function loadFromStorage() {
    const data = storageGetJson<{
      birthYear?: string
      birthMonth?: string
      birthDay?: string
      zodiacSign?: string
    }>(StorageKeys.ZODIAC_BIRTH, LegacyKeys.zodiac)
    if (!data) return
    birthYear.value = data.birthYear || ''
    birthMonth.value = data.birthMonth || ''
    birthDay.value = data.birthDay || ''
    zodiacSign.value = data.zodiacSign || ''
  }

  function saveToStorage() {
    storageSetJson(StorageKeys.ZODIAC_BIRTH, {
      birthYear: birthYear.value,
      birthMonth: birthMonth.value,
      birthDay: birthDay.value,
      zodiacSign: zodiacSign.value,
    })
  }

  function onBirthdayChange() {
    const month = parseInt(birthMonth.value)
    const day = parseInt(birthDay.value)
    if (month && day) {
      zodiacSign.value = calculateZodiac(month, day)
      saveToStorage()
    } else {
      zodiacSign.value = ''
    }
  }

  /** 从 YYYY-MM-DD 生日字符串填充（用于从个人中心资料自动带入，免去重复输入） */
  function setFromDate(dateStr: string | null | undefined): boolean {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return false
    const [y, m, d] = dateStr.slice(0, 10).split('-').map((s) => parseInt(s, 10))
    if (!y || !m || !d) return false
    birthYear.value = String(y)
    birthMonth.value = String(m)
    birthDay.value = String(d)
    zodiacSign.value = calculateZodiac(m, d)
    saveToStorage()
    return true
  }

  function clearBirthday() {
    birthYear.value = ''
    birthMonth.value = ''
    birthDay.value = ''
    zodiacSign.value = ''
    storageRemoveRawAndLegacy(StorageKeys.ZODIAC_BIRTH, LegacyKeys.zodiac)
  }

  return {
    birthYear, birthMonth, birthDay, zodiacSign,
    loadFromStorage, onBirthdayChange, setFromDate, clearBirthday,
  }
}
