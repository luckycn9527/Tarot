import test from 'node:test'
import assert from 'node:assert/strict'
import { createI18n } from 'vue-i18n'
import { pagesZh as zh } from '../src/locales/pages.zh'
import { pagesEn as en } from '../src/locales/pages.en'

test('feedback email placeholders render literal email symbols in both languages', () => {
  for (const [locale, pages] of [['zh', zh], ['en', en]] as const) {
    const i18n = createI18n({ legacy: false, locale, messages: { [locale]: { pages } } })
    assert.equal(i18n.global.t('pages.feedback.emailPlaceholder'), 'your@email.com')
  }
})
