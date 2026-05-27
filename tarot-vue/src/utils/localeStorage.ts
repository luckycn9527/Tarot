export type AppLocale = 'zh-CN' | 'en-US'

const KEY = 'etomd:v1:locale'

export function getStoredLocale(): AppLocale | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en-US' || v === 'zh-CN') return v
  } catch {
    /* private mode */
  }
  return null
}

export function setStoredLocale(locale: AppLocale): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, locale)
  } catch {
    /* ignore */
  }
}

/** 同步 `<html lang>`，利于无障碍与爬虫理解页面语言 */
export function applyLocaleToDocument(locale: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale === 'en-US' ? 'en' : 'zh-CN'
}
