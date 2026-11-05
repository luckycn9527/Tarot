import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN'
import enUS from '@/locales/en-US'
import { getStoredLocale, type AppLocale } from '@/utils/localeStorage'

function initialLocale(): AppLocale {
  const s = getStoredLocale()
  if (s) return s

  const configured = import.meta.env.VITE_DEFAULT_LOCALE
  if (configured === 'en-US' || configured === 'zh-CN') return configured

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase()
    // The overseas deployment has its own hostname, so visitors get English
    // before any browser-language or IP-specific heuristics are considered.
    if (hostname === 'asktarot.zaopic.cn' || hostname.endsWith('.asktarot.zaopic.cn')) return 'en-US'
    const preferred = navigator.languages?.[0] ?? navigator.language
    if (preferred && !preferred.toLowerCase().startsWith('zh')) return 'en-US'
  }

  return 'zh-CN'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
  missingWarn: false,
  fallbackWarn: false,
})
