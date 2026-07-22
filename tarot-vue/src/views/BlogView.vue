<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Search from '@icons/search.vue'
import ArrowRight from '@icons/arrow-right.vue'
import Clock from '@icons/clock.vue'
import { blogPosts, getBlogAuthor, type BlogCategory, type BlogPost } from '@/data/blogPosts'
import { getCardImageUrl } from '@/data/tarotCards'
import { getReaderById } from '@/data/readers'
import { getReaderAvatarSrc } from '@/utils/readerDisplay'
import { useScrollReveal } from '@/composables/useScrollReveal'

useScrollReveal()

const { locale } = useI18n()
const query = ref('')
const activeCategory = ref<'all' | BlogCategory>('all')
const isZh = computed(() => String(locale.value).toLowerCase().startsWith('zh'))

const copy = computed(() => isZh.value ? {
  eyebrow: 'TAROT NOTES',
  title: '塔罗师手记',
  subtitle: '关于塔罗学习、读牌交流与长期经验的真实记录。',
  search: '搜索文章、主题或塔罗师',
  all: '全部',
  learning: '学习',
  discussion: '交流',
  experience: '经验',
  featured: '本期精选',
  latest: '最新文章',
  minRead: '分钟阅读',
  read: '阅读全文',
  empty: '没有找到符合条件的文章',
  emptyHint: '换一个关键词或分类试试。',
  verified: '塔罗师署名',
} : {
  eyebrow: 'TAROT NOTES',
  title: 'Notes from Tarot readers',
  subtitle: 'Practical writing on learning Tarot, exchanging ideas, and building long-term experience.',
  search: 'Search articles, topics, or readers',
  all: 'All',
  learning: 'Learning',
  discussion: 'Discussion',
  experience: 'Experience',
  featured: 'Featured',
  latest: 'Latest articles',
  minRead: 'min read',
  read: 'Read article',
  empty: 'No matching articles',
  emptyHint: 'Try another keyword or category.',
  verified: 'Reader byline',
})

const categories = computed(() => [
  { key: 'all' as const, label: copy.value.all },
  { key: 'learning' as const, label: copy.value.learning },
  { key: 'discussion' as const, label: copy.value.discussion },
  { key: 'experience' as const, label: copy.value.experience },
])

const featuredPost = computed(() => blogPosts.find((post) => post.featured) ?? blogPosts[0])

const filteredPosts = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  return blogPosts.filter((post) => {
    const categoryMatches = activeCategory.value === 'all' || post.category === activeCategory.value
    if (!categoryMatches) return false
    if (!normalized) return true
    const author = getBlogAuthor(post.authorSlug)
    return [
      post.title,
      post.titleEn,
      post.excerpt,
      post.excerptEn,
      ...post.tags,
      ...post.tagsEn,
      author?.name,
      author?.nameEn,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalized)
  })
})

function localized(zh: string, en: string) {
  return isZh.value ? zh : en
}

function localizedTitle(post: BlogPost) {
  return localized(post.title, post.titleEn)
}

function authorAvatar(post: BlogPost) {
  const author = getBlogAuthor(post.authorSlug)
  if (!author) return ''
  const reader = getReaderById(author.readerId)
  return reader ? getReaderAvatarSrc(reader) : ''
}

function formattedDate(date: string) {
  return new Intl.DateTimeFormat(isZh.value ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: isZh.value ? 'long' : 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}
</script>

<template>
  <div class="blog-page relative z-10">
    <header class="blog-hero">
      <div class="blog-shell">
        <p class="blog-eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.title }}</h1>
        <p class="blog-intro">{{ copy.subtitle }}</p>
      </div>
    </header>

    <main class="blog-shell pb-24">
      <section v-if="featuredPost" class="blog-feature reveal-on-scroll" :aria-label="copy.featured">
        <div class="blog-feature-copy">
          <span class="blog-section-label">{{ copy.featured }}</span>
          <RouterLink :to="`/blog/${featuredPost.slug}`" class="blog-feature-title">
            {{ localizedTitle(featuredPost) }}
          </RouterLink>
          <p>{{ localized(featuredPost.excerpt, featuredPost.excerptEn) }}</p>
          <div class="blog-byline">
            <div class="blog-avatar" aria-hidden="true">
              <img v-if="authorAvatar(featuredPost)" :src="authorAvatar(featuredPost)" alt="" />
              <span v-else>{{ getBlogAuthor(featuredPost.authorSlug)?.fallbackMark }}</span>
            </div>
            <div>
              <strong>{{ localized(getBlogAuthor(featuredPost.authorSlug)?.name ?? '', getBlogAuthor(featuredPost.authorSlug)?.nameEn ?? '') }}</strong>
              <small>{{ copy.verified }} · {{ featuredPost.readingMinutes }} {{ copy.minRead }}</small>
            </div>
          </div>
          <RouterLink :to="`/blog/${featuredPost.slug}`" class="blog-read-link">
            <span>{{ copy.read }}</span>
            <ArrowRight :size="17" aria-hidden="true" />
          </RouterLink>
        </div>
        <RouterLink :to="`/blog/${featuredPost.slug}`" class="blog-feature-cover" :aria-label="localizedTitle(featuredPost)">
          <img :src="getCardImageUrl(featuredPost.coverCardNameEn)" :alt="localized(featuredPost.coverAlt, featuredPost.coverAltEn)" />
        </RouterLink>
      </section>

      <section class="blog-index" aria-labelledby="blog-latest-heading">
        <div class="blog-index-header">
          <h2 id="blog-latest-heading">{{ copy.latest }}</h2>
          <label class="blog-search">
            <Search :size="18" aria-hidden="true" />
            <input v-model="query" type="search" :placeholder="copy.search" />
          </label>
        </div>

        <div class="blog-filters" role="group" :aria-label="copy.latest">
          <button
            v-for="category in categories"
            :key="category.key"
            type="button"
            :class="{ active: activeCategory === category.key }"
            @click="activeCategory = category.key"
          >
            {{ category.label }}
          </button>
        </div>

        <div v-if="filteredPosts.length" class="blog-list">
          <article v-for="post in filteredPosts" :key="post.slug" class="blog-list-item reveal-on-scroll">
            <RouterLink :to="`/blog/${post.slug}`" class="blog-list-cover" tabindex="-1" aria-hidden="true">
              <img :src="getCardImageUrl(post.coverCardNameEn)" :alt="localized(post.coverAlt, post.coverAltEn)" loading="lazy" />
            </RouterLink>
            <div class="blog-list-copy">
              <div class="blog-list-meta">
                <span>{{ categories.find((category) => category.key === post.category)?.label }}</span>
                <span>{{ formattedDate(post.publishedAt) }}</span>
                <span class="blog-read-time"><Clock :size="14" aria-hidden="true" />{{ post.readingMinutes }} {{ copy.minRead }}</span>
              </div>
              <RouterLink :to="`/blog/${post.slug}`" class="blog-list-title">{{ localizedTitle(post) }}</RouterLink>
              <p>{{ localized(post.excerpt, post.excerptEn) }}</p>
              <div class="blog-list-footer">
                <div class="blog-author-inline">
                  <div class="blog-avatar blog-avatar-small" aria-hidden="true">
                    <img v-if="authorAvatar(post)" :src="authorAvatar(post)" alt="" />
                    <span v-else>{{ getBlogAuthor(post.authorSlug)?.fallbackMark }}</span>
                  </div>
                  <span>{{ localized(getBlogAuthor(post.authorSlug)?.name ?? '', getBlogAuthor(post.authorSlug)?.nameEn ?? '') }}</span>
                </div>
                <RouterLink :to="`/blog/${post.slug}`" class="blog-read-link blog-read-link-small">
                  <span>{{ copy.read }}</span>
                  <ArrowRight :size="16" aria-hidden="true" />
                </RouterLink>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="blog-empty">
          <h3>{{ copy.empty }}</h3>
          <p>{{ copy.emptyHint }}</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.blog-page { color: #e8e0d4; }
.blog-shell { width: min(100% - 2rem, 70rem); margin-inline: auto; }
.blog-hero { padding: 4.5rem 0 2.5rem; }
.blog-eyebrow, .blog-section-label { color: rgba(212, 168, 83, .72); font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.blog-hero h1 { max-width: 15ch; margin-top: .7rem; color: #fff; font-family: var(--font-cinzel); font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 700; letter-spacing: 0; line-height: 1.02; }
.blog-intro { max-width: 40rem; margin-top: 1rem; color: rgba(232, 224, 212, .58); font-size: 1rem; line-height: 1.75; }
.blog-feature { display: grid; min-height: 29rem; grid-template-columns: minmax(0, 1.2fr) minmax(15rem, .8fr); border-top: 1px solid rgba(212, 168, 83, .18); border-bottom: 1px solid rgba(212, 168, 83, .12); }
.blog-feature-copy { display: flex; align-items: flex-start; justify-content: center; flex-direction: column; padding: 3.25rem clamp(1rem, 5vw, 4.5rem) 3.25rem 0; }
.blog-feature-title { max-width: 17ch; margin-top: .8rem; color: #fff; font-family: var(--font-cinzel); font-size: clamp(1.9rem, 3.6vw, 3.1rem); font-weight: 700; letter-spacing: 0; line-height: 1.16; }
.blog-feature-title:hover, .blog-list-title:hover { color: var(--color-gold-200); }
.blog-feature-copy > p { max-width: 39rem; margin-top: 1.2rem; color: rgba(232, 224, 212, .62); font-size: .96rem; line-height: 1.8; }
.blog-feature-cover { position: relative; display: flex; min-height: 29rem; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(150deg, rgba(88, 58, 113, .24), rgba(15, 9, 24, .8)); }
.blog-feature-cover::before { position: absolute; inset: 1.1rem; border: 1px solid rgba(212, 168, 83, .12); content: ''; pointer-events: none; }
.blog-feature-cover img { width: min(64%, 15rem); max-height: 23rem; object-fit: contain; filter: drop-shadow(0 22px 36px rgba(0, 0, 0, .45)); transition: transform .35s ease; }
.blog-feature-cover:hover img { transform: translateY(-4px); }
.blog-byline, .blog-author-inline { display: flex; align-items: center; gap: .7rem; }
.blog-byline { margin-top: 1.5rem; }
.blog-byline strong { display: block; color: rgba(255, 255, 255, .9); font-size: .83rem; }
.blog-byline small { display: block; margin-top: .13rem; color: rgba(232, 224, 212, .42); font-size: .72rem; }
.blog-avatar { display: flex; width: 2.5rem; height: 2.5rem; flex: 0 0 auto; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(212, 168, 83, .22); border-radius: 50%; background: rgba(212, 168, 83, .08); color: var(--color-gold-200); font-family: var(--font-cinzel); }
.blog-avatar img { width: 100%; height: 100%; object-fit: cover; }
.blog-read-link { display: inline-flex; align-items: center; gap: .5rem; margin-top: 1.55rem; color: var(--color-gold-300); font-size: .85rem; font-weight: 700; }
.blog-read-link:hover { color: #fff; }
.blog-index { padding-top: 5rem; }
.blog-index-header { display: flex; align-items: end; justify-content: space-between; gap: 2rem; }
.blog-index-header h2 { color: #fff; font-family: var(--font-cinzel); font-size: clamp(1.55rem, 3vw, 2.15rem); font-weight: 700; }
.blog-search { display: flex; width: min(100%, 20rem); min-height: 2.7rem; align-items: center; gap: .6rem; padding: 0 .85rem; border: 1px solid rgba(212, 168, 83, .16); border-radius: 8px; background: rgba(17, 10, 27, .72); color: rgba(232, 224, 212, .38); }
.blog-search:focus-within { border-color: rgba(212, 168, 83, .45); box-shadow: 0 0 0 3px rgba(212, 168, 83, .08); }
.blog-search input { min-width: 0; flex: 1; background: transparent; color: #fff; font-size: .83rem; outline: none; }
.blog-search input::placeholder { color: rgba(232, 224, 212, .35); }
.blog-filters { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: 1.4rem; }
.blog-filters button { min-height: 2.25rem; padding: .4rem .8rem; border: 1px solid transparent; border-radius: 7px; color: rgba(232, 224, 212, .52); font-size: .8rem; transition: border-color .2s ease, background .2s ease, color .2s ease; }
.blog-filters button:hover { color: #fff; }
.blog-filters button.active { border-color: rgba(212, 168, 83, .24); background: rgba(212, 168, 83, .08); color: var(--color-gold-200); }
.blog-list { margin-top: 1.6rem; }
.blog-list-item { display: grid; grid-template-columns: 10.5rem minmax(0, 1fr); gap: clamp(1.25rem, 3vw, 2.25rem); padding: 2rem 0; border-top: 1px solid rgba(255, 255, 255, .07); }
.blog-list-item:last-child { border-bottom: 1px solid rgba(255, 255, 255, .07); }
.blog-list-cover { display: flex; min-height: 14.5rem; align-items: center; justify-content: center; overflow: hidden; border-radius: 7px; background: linear-gradient(155deg, rgba(80, 54, 104, .2), rgba(12, 7, 20, .88)); }
.blog-list-cover img { width: 72%; max-height: 12rem; object-fit: contain; filter: drop-shadow(0 15px 22px rgba(0, 0, 0, .4)); transition: transform .3s ease; }
.blog-list-cover:hover img { transform: scale(1.025); }
.blog-list-copy { display: flex; min-width: 0; flex-direction: column; }
.blog-list-meta { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem .85rem; color: rgba(232, 224, 212, .38); font-size: .72rem; }
.blog-list-meta span:first-child { color: rgba(212, 168, 83, .78); }
.blog-read-time { display: inline-flex; align-items: center; gap: .3rem; }
.blog-list-title { max-width: 30ch; margin-top: .65rem; color: #fff; font-family: var(--font-cinzel); font-size: clamp(1.25rem, 2.4vw, 1.75rem); font-weight: 700; letter-spacing: 0; line-height: 1.3; }
.blog-list-copy > p { max-width: 48rem; margin-top: .65rem; color: rgba(232, 224, 212, .54); font-size: .86rem; line-height: 1.7; }
.blog-list-footer { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-top: auto; padding-top: 1rem; }
.blog-avatar-small { width: 1.85rem; height: 1.85rem; font-size: .7rem; }
.blog-author-inline { color: rgba(232, 224, 212, .58); font-size: .76rem; }
.blog-read-link-small { margin-top: 0; }
.blog-empty { margin-top: 1.6rem; padding: 4rem 1rem; border-top: 1px solid rgba(255, 255, 255, .07); text-align: center; }
.blog-empty h3 { color: rgba(255, 255, 255, .86); font-family: var(--font-cinzel); font-size: 1.15rem; }
.blog-empty p { margin-top: .45rem; color: rgba(232, 224, 212, .42); font-size: .82rem; }

@media (max-width: 760px) {
  .blog-hero { padding-top: 3.5rem; }
  .blog-feature { grid-template-columns: 1fr; }
  .blog-feature-copy { padding: 2.4rem 0; }
  .blog-feature-cover { min-height: 21rem; }
  .blog-index-header { align-items: stretch; flex-direction: column; gap: 1rem; }
  .blog-search { width: 100%; }
  .blog-list-item { grid-template-columns: 7.25rem minmax(0, 1fr); gap: 1rem; }
  .blog-list-cover { min-height: 10rem; }
  .blog-list-title { font-size: 1.15rem; }
  .blog-list-copy > p { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
  .blog-read-link-small { display: none; }
}

@media (max-width: 480px) {
  .blog-shell { width: min(100% - 1.25rem, 70rem); }
  .blog-feature-cover { min-height: 18rem; }
  .blog-list-item { grid-template-columns: 1fr; }
  .blog-list-cover { min-height: 15rem; }
  .blog-list-cover img { width: min(52%, 10rem); }
}

@media (prefers-reduced-motion: reduce) {
  .blog-feature-cover img, .blog-list-cover img { transition: none; }
}
</style>
