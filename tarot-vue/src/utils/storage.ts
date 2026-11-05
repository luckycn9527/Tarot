/**
 * 命名空间本地存储：避免与第三方脚本键冲突，并便于日后迁移版本。
 * 认证 token 仍沿用 `tarot_access_token`（见 api.ts），不在此枚举中改动。
 */
import { getSessionScope } from './sessionScope'

const NS = 'etomd'
const VER = 'v1'

function nsKey(logicalKey: string): string {
  return `${NS}:${VER}:user:${getSessionScope().owner ?? 'guest'}:${logicalKey}`
}

export const StorageKeys = {
  DAILY_FORTUNE: 'dailyFortune',
  /** 每日运势 AI 结果 JSON（原裸 key `dailyFortuneResult`） */
  DAILY_FORTUNE_RESULT: 'dailyFortuneResult',
  ZODIAC_BIRTH: 'zodiacBirth',
  FEEDBACK_HISTORY: 'feedbacks',
  YES_NO_USER_Q: 'yesNoUserQuestion',
  YES_NO_SINGLE_RESULT: 'yesNoSingleResult',
  YES_NO_SINGLE_CARD: 'yesNoSingleCard',
  YES_NO_SINGLE_ORIENT: 'yesNoSingleOrient',
  YES_NO_SINGLE_REQUEST: 'yesNoSingleRequest',
  YES_NO_THREE_RESULT: 'yesNoThreeResult',
  YES_NO_THREE_CARDS: 'yesNoThreeCards',
  YES_NO_THREE_ORIENTS: 'yesNoThreeOrients',
} as const

/** 旧版裸 key（迁移用） */
const LegacyKeys = {
  dailyFortune: 'dailyFortuneCache',
  zodiac: 'userZodiacInfo',
  feedbacks: 'tarot_feedbacks',
} as const

export function storageGet(logicalKey: string): string | null {
  try {
    return localStorage.getItem(nsKey(logicalKey))
  } catch {
    return null
  }
}

/** Old keys have no owner: importing them into the next login would leak data. */
export function clearUnownedPrivateStorage() {
  for (const key of Object.values(StorageKeys)) {
    try { localStorage.removeItem(`${NS}:${VER}:${key}`) } catch { /* unavailable */ }
  }
  for (const key of [...Object.values(LegacyKeys), 'dailyFortuneResult', 'userQuestion',
    'singleCardReadingResult', 'singleCardSelectedCard', 'singleCardOrientation',
    'threeCardReadingResult', 'threeCardSelectedCards', 'threeCardOrientations']) {
    try { localStorage.removeItem(key) } catch { /* unavailable */ }
  }
}

export function clearPrivateStorage(userId: number | null) {
  for (const key of Object.values(StorageKeys)) {
    try { localStorage.removeItem(`${NS}:${VER}:user:${userId ?? 'guest'}:${key}`) } catch { /* unavailable */ }
  }
}

/** 读取 JSON；优先新 key，再尝试 legacy key 并回填 */
export function storageGetJson<T>(logicalKey: string, legacyRawKey?: string): T | null {
  // Legacy private values cannot be attributed to an account.
  if (legacyRawKey) {
    try { localStorage.removeItem(legacyRawKey) } catch { /* unavailable */ }
  }
  const raw = storageGet(logicalKey)
  if (raw) {
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }
  return null
}

export function storageSet(logicalKey: string, value: string): void {
  try {
    localStorage.setItem(nsKey(logicalKey), value)
  } catch {
    /* quota / private mode */
  }
}

export function storageSetJson(logicalKey: string, value: unknown): void {
  storageSet(logicalKey, JSON.stringify(value))
}

export function storageRemove(logicalKey: string): void {
  try {
    localStorage.removeItem(nsKey(logicalKey))
  } catch {
    /* ignore */
  }
}

/** 非 JSON 字符串：先读命名空间 key，再读 legacy 裸 key 并迁移 */
export function storageGetRaw(logicalKey: string, legacyBareKey?: string): string | null {
  if (legacyBareKey) {
    try { localStorage.removeItem(legacyBareKey) } catch { /* unavailable */ }
  }
  return storageGet(logicalKey)
}

export function storageRemoveRawAndLegacy(logicalKey: string, ...legacyBareKeys: string[]): void {
  storageRemove(logicalKey)
  for (const k of legacyBareKeys) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  }
}

export { LegacyKeys }
