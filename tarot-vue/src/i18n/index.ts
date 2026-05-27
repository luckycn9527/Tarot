import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN'
import enUS from '@/locales/en-US'
import { getStoredLocale, type AppLocale } from '@/utils/localeStorage'

function initialLocale(): AppLocale {
  const s = getStoredLocale()
  return s ?? 'zh-CN'
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
