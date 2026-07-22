<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { oracleCards, type OracleCard, type OracleCategory } from '../data/oracleCards'
import { ossAssetUrl } from '../utils/publicAssetUrl'

useScrollReveal()

const { locale } = useI18n()
const activeCategory = ref<'all' | OracleCategory>('all')
const query = ref('')
const selectedCard = ref<OracleCard | null>(null)

const isZh = computed(() => String(locale.value).toLowerCase().startsWith('zh'))

const copy = computed(() => isZh.value ? {
  eyebrow: 'ORACLE REFERENCE · 36 CARDS',
  title: '神谕图鉴',
  subtitle: '雷诺曼 36 张传统神谕牌',
  intro: '从日常象征读出清晰线索。浏览牌序、关键词与一段适合快速复习的牌义。',
  drawCard: '抽一张神谕牌',
  tryTarot: '进入塔罗占卜',
  searchPlaceholder: '搜索牌名或关键词',
  all: '全部',
  count: '张牌',
  cardNumber: '第',
  cardNumberSuffix: '张',
  keywords: '关键词',
  interpretation: '基础牌义',
  close: '关闭详情',
  sourceTitle: '资料说明',
  sourceBody: '牌名与牌序参考传统德国《希望游戏》/雷诺曼体系；关键词与释义由本项目整理，仅作自我反思与学习参考。',
  sources: '公开参考资料',
  sourceWiki: 'Wikipedia：Marie Anne Lenormand',
  sourceReader: 'Lenormand Reader：Card Meanings',
  sourceCommons: 'Wikimedia Commons：The Game of Hope',
} : {
  eyebrow: 'ORACLE REFERENCE · 36 CARDS',
  title: 'Oracle gallery',
  subtitle: 'The traditional 36-card Lenormand system',
  intro: 'Read clear signals through everyday symbols. Browse the sequence, keywords, and concise study notes.',
  drawCard: 'Draw an oracle card',
  tryTarot: 'Try a Tarot reading',
  searchPlaceholder: 'Search a card or keyword',
  all: 'All',
  count: 'cards',
  cardNumber: 'Card',
  cardNumberSuffix: '',
  keywords: 'Keywords',
  interpretation: 'Core meaning',
  close: 'Close details',
  sourceTitle: 'About this guide',
  sourceBody: 'Names and sequence follow the traditional German Game of Hope / Lenormand system. Keywords and notes are curated by this project for reflection and study.',
  sources: 'Public references',
  sourceWiki: 'Wikipedia: Marie Anne Lenormand',
  sourceReader: 'Lenormand Reader: Card Meanings',
  sourceCommons: 'Wikimedia Commons: The Game of Hope',
})

const categories = computed(() => {
  const labels = isZh.value
    ? { people: '人物', nature: '自然', movement: '行动', relationships: '关系', matters: '事务' }
    : { people: 'People', nature: 'Nature', movement: 'Movement', relationships: 'Relationships', matters: 'Matters' }
  return [
    { key: 'all' as const, label: copy.value.all },
    ...Object.entries(labels).map(([key, label]) => ({ key: key as OracleCategory, label })),
  ]
})

const filteredCards = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return oracleCards.filter((card) => {
    const matchesCategory = activeCategory.value === 'all' || card.category === activeCategory.value
    if (!normalizedQuery) return matchesCategory
    const searchable = [card.name, card.nameEn, card.keywords, card.keywordsEn].join(' ').toLowerCase()
    return matchesCategory && searchable.includes(normalizedQuery)
  })
})

function cardName(card: OracleCard) {
  return isZh.value ? card.name : card.nameEn
}

function cardKeywords(card: OracleCard) {
  return isZh.value ? card.keywords : card.keywordsEn
}

function cardMeaning(card: OracleCard) {
  return isZh.value ? card.meaning : card.meaningEn
}

function cardImage(card: OracleCard) {
  return ossAssetUrl(`images/oracle/lenormand-${String(card.id).padStart(2, '0')}.svg`)
}

function categoryLabel(category: OracleCategory) {
  return categories.value.find((item) => item.key === category)?.label || category
}

function openCard(card: OracleCard) {
  selectedCard.value = card
}

function drawOracleCard() {
  const card = oracleCards[Math.floor(Math.random() * oracleCards.length)]
  if (card) openCard(card)
}

function closeCard() {
  selectedCard.value = null
}

function hideBrokenImage(event: Event) {
  if (event.currentTarget instanceof HTMLImageElement) event.currentTarget.hidden = true
}
</script>

<template>
  <div class="oracle-gallery-page relative z-10">
    <section class="oracle-gallery-hero">
      <div class="oracle-gallery-hero-inner animate-fade-in-up">
        <p class="oracle-gallery-eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.title }}</h1>
        <p class="oracle-gallery-subtitle">{{ copy.subtitle }}</p>
        <p class="oracle-gallery-intro">{{ copy.intro }}</p>
        <div class="oracle-gallery-stats" aria-label="Oracle gallery summary">
          <span><strong>36</strong> {{ copy.count }}</span>
          <span><strong>4</strong> {{ isZh ? '花色线索' : 'suit layers' }}</span>
          <span><strong>1</strong> {{ isZh ? '传统体系' : 'system' }}</span>
        </div>
        <div class="oracle-gallery-actions">
          <button type="button" class="oracle-primary-action" @click="drawOracleCard">{{ copy.drawCard }}</button>
          <RouterLink to="/tarot" class="oracle-secondary-action">{{ copy.tryTarot }}</RouterLink>
        </div>
      </div>
    </section>

    <section class="oracle-gallery-controls" aria-label="Oracle card filters">
      <label class="oracle-search">
        <span class="sr-only">{{ copy.searchPlaceholder }}</span>
        <input v-model="query" type="search" :placeholder="copy.searchPlaceholder">
        <span aria-hidden="true">⌕</span>
      </label>
      <div class="oracle-category-tabs" role="tablist">
        <button
          v-for="category in categories"
          :key="category.key"
          type="button"
          role="tab"
          :aria-selected="activeCategory === category.key"
          :class="{ active: activeCategory === category.key }"
          @click="activeCategory = category.key"
        >
          {{ category.label }}
        </button>
      </div>
    </section>

    <section class="oracle-gallery-grid-wrap">
      <div class="oracle-gallery-grid" aria-live="polite">
        <button
          v-for="card in filteredCards"
          :key="card.id"
          type="button"
          class="oracle-card-tile"
          :aria-label="`${copy.cardNumber} ${card.id} ${cardName(card)}`"
          @click="openCard(card)"
        >
          <span class="oracle-card-art">
            <img :src="cardImage(card)" :alt="`${cardName(card)} oracle card artwork`" loading="lazy" class="oracle-card-art-image" @error="hideBrokenImage">
            <span class="oracle-card-number">{{ String(card.id).padStart(2, '0') }}</span>
            <span class="oracle-card-symbol" aria-hidden="true">{{ card.symbol }}</span>
            <span class="oracle-card-pip">{{ card.pip }}</span>
          </span>
          <span class="oracle-card-info">
            <span class="oracle-card-title-row">
              <strong>{{ cardName(card) }}</strong>
              <small>{{ card.nameEn }}</small>
            </span>
            <span class="oracle-card-category">{{ categoryLabel(card.category) }}</span>
            <span class="oracle-card-keywords">{{ cardKeywords(card) }}</span>
          </span>
        </button>
      </div>
      <p v-if="filteredCards.length === 0" class="oracle-empty">{{ isZh ? '没有找到匹配的牌。' : 'No matching cards found.' }}</p>
      <p class="oracle-result-count">{{ filteredCards.length }} / 36 {{ copy.count }}</p>
    </section>

    <section class="oracle-gallery-source">
      <div>
        <p class="oracle-gallery-eyebrow">{{ copy.sourceTitle }}</p>
        <p>{{ copy.sourceBody }}</p>
      </div>
      <div class="oracle-gallery-source-links">
        <span>{{ copy.sources }}</span>
        <a href="https://en.wikipedia.org/wiki/Marie_Anne_Lenormand#Lenormand_cards" target="_blank" rel="noreferrer">{{ copy.sourceWiki }}</a>
        <a href="https://www.lenormandreader.com/lenormand-card-meanings/" target="_blank" rel="noreferrer">{{ copy.sourceReader }}</a>
        <a href="https://commons.wikimedia.org/wiki/File:Das_Spiel_der_Hofnung_(The_Game_of_Hope).png" target="_blank" rel="noreferrer">{{ copy.sourceCommons }}</a>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="selectedCard" class="oracle-detail-backdrop" role="presentation" @click.self="closeCard">
        <section class="oracle-detail-dialog" role="dialog" aria-modal="true" :aria-label="cardName(selectedCard)">
          <button type="button" class="oracle-detail-close" :aria-label="copy.close" @click="closeCard">×</button>
          <div class="oracle-detail-art oracle-card-art">
            <img :src="cardImage(selectedCard)" :alt="`${cardName(selectedCard)} oracle card artwork`" class="oracle-card-art-image" @error="hideBrokenImage">
            <span class="oracle-card-number">{{ String(selectedCard.id).padStart(2, '0') }}</span>
            <span class="oracle-card-symbol" aria-hidden="true">{{ selectedCard.symbol }}</span>
            <span class="oracle-card-pip">{{ selectedCard.pip }}</span>
          </div>
          <div class="oracle-detail-content">
            <p class="oracle-gallery-eyebrow">{{ copy.cardNumber }} {{ selectedCard.id }}{{ copy.cardNumberSuffix }}</p>
            <h2>{{ cardName(selectedCard) }}</h2>
            <p class="oracle-detail-en">{{ selectedCard.nameEn }} · {{ categoryLabel(selectedCard.category) }}</p>
            <p class="oracle-detail-label">{{ copy.keywords }}</p>
            <p class="oracle-detail-keywords">{{ cardKeywords(selectedCard) }}</p>
            <p class="oracle-detail-label">{{ copy.interpretation }}</p>
            <p class="oracle-detail-meaning">{{ cardMeaning(selectedCard) }}</p>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.oracle-gallery-page { color: rgba(245, 239, 231, .88); }
.oracle-gallery-hero { padding: 7.5rem 1rem 3rem; text-align: center; }
.oracle-gallery-hero-inner { max-width: 52rem; margin: 0 auto; }
.oracle-gallery-eyebrow { margin: 0; color: rgba(220, 181, 101, .78); font-size: .68rem; font-weight: 800; letter-spacing: .16em; line-height: 1.4; text-transform: uppercase; }
.oracle-gallery-hero h1 { margin: .8rem 0 .55rem; color: #fff; font-family: var(--font-cinzel); font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 700; line-height: 1.05; }
.oracle-gallery-subtitle { margin: 0; color: rgba(245, 239, 231, .7); font-family: var(--font-cinzel); font-size: 1.05rem; }
.oracle-gallery-intro { max-width: 36rem; margin: 1.2rem auto 0; color: rgba(245, 239, 231, .5); font-size: .9rem; line-height: 1.7; }
.oracle-gallery-stats { display: flex; justify-content: center; gap: 2.3rem; margin-top: 1.8rem; color: rgba(245, 239, 231, .45); font-size: .72rem; }
.oracle-gallery-stats span { display: flex; align-items: baseline; gap: .35rem; }
.oracle-gallery-stats strong { color: var(--color-gold-300); font-size: 1.15rem; font-weight: 800; }
.oracle-gallery-actions { display: flex; justify-content: center; gap: .65rem; margin-top: 1.7rem; }
.oracle-primary-action, .oracle-secondary-action { display: inline-flex; min-height: 2.65rem; align-items: center; justify-content: center; padding: .6rem 1rem; border-radius: 10px; font-size: .78rem; font-weight: 800; transition: transform .2s ease, background .2s ease, border-color .2s ease; }
.oracle-primary-action { color: #1a1122; background: var(--color-gold-300); }
.oracle-primary-action:hover { background: #f2d38a; transform: translateY(-1px); }
.oracle-secondary-action { border: 1px solid rgba(220, 181, 101, .25); color: rgba(245, 239, 231, .68); }
.oracle-secondary-action:hover { border-color: rgba(220, 181, 101, .6); color: #fff; transform: translateY(-1px); }
.oracle-gallery-controls { display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: min(100% - 2rem, 72rem); margin: 0 auto 1.5rem; padding: .7rem; border: 1px solid rgba(220, 181, 101, .12); border-radius: 16px; background: rgba(16, 11, 27, .7); }
.oracle-search { position: relative; display: flex; align-items: center; width: min(100%, 17rem); }
.oracle-search input { width: 100%; min-height: 2.45rem; padding: .55rem 2.2rem .55rem .85rem; border: 1px solid rgba(255, 255, 255, .1); border-radius: 10px; outline: 0; background: rgba(255, 255, 255, .035); color: #fff; font-size: .8rem; }
.oracle-search input:focus { border-color: rgba(220, 181, 101, .65); box-shadow: 0 0 0 3px rgba(220, 181, 101, .1); }
.oracle-search input::placeholder { color: rgba(245, 239, 231, .35); }
.oracle-search > span:last-child { position: absolute; right: .8rem; color: var(--color-gold-300); font-size: 1.1rem; }
.oracle-category-tabs { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .35rem; }
.oracle-category-tabs button { min-height: 2.35rem; padding: .45rem .75rem; border: 1px solid transparent; border-radius: 9px; color: rgba(245, 239, 231, .5); background: transparent; font-size: .76rem; font-weight: 700; transition: color .2s ease, background .2s ease, border-color .2s ease; }
.oracle-category-tabs button:hover { color: #fff; border-color: rgba(220, 181, 101, .25); }
.oracle-category-tabs button.active { color: #1a1122; border-color: var(--color-gold-300); background: var(--color-gold-300); }
.oracle-gallery-grid-wrap { width: min(100% - 2rem, 72rem); margin: 0 auto; }
.oracle-gallery-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: .75rem; }
.oracle-card-tile { min-width: 0; padding: 0; overflow: hidden; border: 1px solid rgba(220, 181, 101, .14); border-radius: 14px; background: rgba(22, 15, 34, .84); text-align: left; cursor: pointer; transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
.oracle-card-tile:hover { transform: translateY(-3px); border-color: rgba(220, 181, 101, .6); box-shadow: 0 14px 28px rgba(0, 0, 0, .24); }
.oracle-card-art { position: relative; display: flex; aspect-ratio: 3 / 4; align-items: center; justify-content: center; overflow: hidden; background: radial-gradient(circle at 50% 20%, rgba(220, 181, 101, .2), transparent 48%), linear-gradient(150deg, rgba(49, 31, 68, .95), rgba(14, 11, 24, .98)); }
.oracle-card-art-image { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .96; }
.oracle-card-art::after { position: absolute; z-index: 3; inset: .5rem; border: 1px solid rgba(220, 181, 101, .22); border-radius: 9px; content: ''; pointer-events: none; }
.oracle-card-number { position: absolute; z-index: 0; top: .7rem; left: .7rem; color: rgba(245, 239, 231, .9); font-size: .64rem; font-weight: 800; letter-spacing: .08em; }
.oracle-card-symbol { position: relative; z-index: 0; color: rgba(238, 203, 126, .9); font-family: Georgia, serif; font-size: clamp(2.4rem, 4vw, 3.8rem); line-height: 1; text-shadow: 0 0 24px rgba(220, 181, 101, .22); }
.oracle-card-pip { position: absolute; z-index: 2; right: .7rem; bottom: .65rem; color: rgba(245, 239, 231, .9); font-size: .66rem; font-weight: 700; text-shadow: 0 1px 5px rgba(0, 0, 0, .8); }
.oracle-card-info { display: block; padding: .7rem .75rem .8rem; }
.oracle-card-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: .35rem; }
.oracle-card-title-row strong { overflow: hidden; color: #fff; font-family: var(--font-cinzel); font-size: .83rem; text-overflow: ellipsis; white-space: nowrap; }
.oracle-card-title-row small { color: rgba(245, 239, 231, .34); font-size: .58rem; white-space: nowrap; }
.oracle-card-category { display: block; margin-top: .25rem; color: var(--color-gold-300); font-size: .61rem; font-weight: 700; }
.oracle-card-keywords { display: block; min-height: 2.3em; margin-top: .35rem; color: rgba(245, 239, 231, .46); font-size: .65rem; line-height: 1.45; }
.oracle-result-count, .oracle-empty { color: rgba(245, 239, 231, .4); font-size: .75rem; text-align: center; }
.oracle-result-count { margin: 1.2rem 0 0; }
.oracle-empty { padding: 4rem 0; }
.oracle-gallery-source { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(14rem, .8fr); gap: 2rem; width: min(100% - 2rem, 72rem); margin: 5rem auto 0; padding: 1.4rem 0 5rem; border-top: 1px solid rgba(255, 255, 255, .08); }
.oracle-gallery-source p:not(.oracle-gallery-eyebrow) { max-width: 40rem; margin-top: .55rem; color: rgba(245, 239, 231, .45); font-size: .74rem; line-height: 1.7; }
.oracle-gallery-source-links { display: flex; flex-direction: column; gap: .45rem; font-size: .68rem; }
.oracle-gallery-source-links span { color: rgba(245, 239, 231, .4); }
.oracle-gallery-source-links a { color: rgba(220, 181, 101, .72); text-decoration: underline; text-underline-offset: 3px; }
.oracle-gallery-source-links a:hover { color: #fff; }
.oracle-detail-backdrop { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(5, 3, 10, .78); backdrop-filter: blur(8px); }
.oracle-detail-dialog { position: relative; display: grid; grid-template-columns: minmax(10rem, 15rem) minmax(0, 1fr); gap: 1.5rem; width: min(100%, 38rem); padding: 1rem; border: 1px solid rgba(220, 181, 101, .32); border-radius: 18px; background: #171022; box-shadow: 0 24px 80px rgba(0, 0, 0, .45); }
.oracle-detail-art { border-radius: 12px; }
.oracle-detail-content { align-self: center; padding: .5rem .75rem .5rem 0; }
.oracle-detail-content h2 { margin: .5rem 0 .2rem; color: #fff; font-family: var(--font-cinzel); font-size: 1.8rem; }
.oracle-detail-en { color: rgba(245, 239, 231, .42); font-size: .75rem; }
.oracle-detail-label { margin-top: 1.5rem; color: var(--color-gold-300); font-size: .68rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.oracle-detail-keywords { margin-top: .4rem; color: #fff; font-size: .9rem; font-weight: 700; line-height: 1.55; }
.oracle-detail-meaning { margin-top: .5rem; color: rgba(245, 239, 231, .64); font-size: .82rem; line-height: 1.75; }
.oracle-detail-close { position: absolute; z-index: 1; top: .6rem; right: .65rem; width: 2rem; height: 2rem; border-radius: 50%; color: rgba(245, 239, 231, .7); background: rgba(255, 255, 255, .08); font-size: 1.25rem; line-height: 1; }
.oracle-detail-close:hover { color: #fff; background: rgba(255, 255, 255, .16); }
@media (max-width: 980px) {
  .oracle-gallery-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .oracle-gallery-hero { padding-top: 6.5rem; }
  .oracle-gallery-controls { align-items: stretch; flex-direction: column; }
  .oracle-search { width: 100%; }
  .oracle-category-tabs { justify-content: flex-start; }
  .oracle-gallery-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .6rem; }
  .oracle-card-info { padding-right: .55rem; padding-left: .55rem; }
  .oracle-card-title-row { display: block; }
  .oracle-card-title-row small { display: block; margin-top: .15rem; }
  .oracle-gallery-source { grid-template-columns: 1fr; gap: 1.4rem; }
  .oracle-detail-dialog { grid-template-columns: minmax(7rem, 10rem) minmax(0, 1fr); gap: 1rem; }
  .oracle-detail-content { padding-right: .25rem; }
}
@media (max-width: 430px) {
  .oracle-gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .oracle-gallery-stats { gap: 1rem; }
  .oracle-gallery-actions { flex-direction: column; }
  .oracle-detail-dialog { display: block; max-height: calc(100dvh - 2rem); overflow-y: auto; }
  .oracle-detail-art { width: 8rem; margin: 0 auto; }
  .oracle-detail-content { padding: 1rem .25rem .25rem; }
}
</style>
