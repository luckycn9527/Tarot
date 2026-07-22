<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ArrowLeft from '@icons/arrow-left.vue'
import ArrowRight from '@icons/arrow-right.vue'
import Check from '@icons/check.vue'
import Copy from '@icons/copy.vue'
import Clock from '@icons/clock.vue'
import { blogPosts, getBlogAuthor, getBlogPost, type BlogAuthor, type BlogPost } from '@/data/blogPosts'
import { getCardImageUrl } from '@/data/tarotCards'
import { getReaderById } from '@/data/readers'
import { getReaderAvatarSrc } from '@/utils/readerDisplay'
import { applyDynamicDocumentMeta } from '@/seo/documentMeta'

const route = useRoute()
const router = useRouter()
const { locale } = useI18n()
const copied = ref(false)
let jsonLdElement: HTMLScriptElement | null = null
let copiedTimer: number | null = null

const post = computed(() => getBlogPost(String(route.params.slug ?? '')))
const author = computed(() => post.value ? getBlogAuthor(post.value.authorSlug) : undefined)
const isZh = computed(() => String(locale.value).toLowerCase().startsWith('zh'))

const copy = computed(() => isZh.value ? {
  back: '返回塔罗师手记',
  minRead: '分钟阅读',
  updated: '更新于',
  toc: '本文目录',
  copyLink: '复制链接',
  copied: '已复制',
  by: '本文作者',
  verified: '塔罗师署名内容',
  relatedActions: '继续探索',
  relatedArticles: '相关阅读',
  disclaimer: '本文分享的是塔罗学习与个人实践经验，仅供自我反思，不构成医疗、法律、投资或其他专业建议。',
} : {
  back: 'Back to Tarot notes',
  minRead: 'min read',
  updated: 'Updated',
  toc: 'In this article',
  copyLink: 'Copy link',
  copied: 'Copied',
  by: 'Written by',
  verified: 'Reader byline content',
  relatedActions: 'Keep exploring',
  relatedArticles: 'Related reading',
  disclaimer: 'This article shares Tarot learning and personal practice for reflection only. It is not medical, legal, financial, or other professional advice.',
})

const headings = computed(() => post.value?.blocks.filter((block) => block.type === 'heading') ?? [])
const relatedPosts = computed(() => {
  if (!post.value) return []
  return blogPosts
    .filter((candidate) => candidate.slug !== post.value?.slug)
    .sort((a, b) => Number(b.category === post.value?.category) - Number(a.category === post.value?.category))
    .slice(0, 2)
})

function localized(zh: string, en: string) {
  return isZh.value ? zh : en
}

function localizedTitle(value: BlogPost) {
  return localized(value.title, value.titleEn)
}

function formattedDate(date: string) {
  return new Intl.DateTimeFormat(isZh.value ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: isZh.value ? 'long' : 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

function authorAvatar(value?: BlogAuthor) {
  if (!value) return ''
  const reader = getReaderById(value.readerId)
  return reader ? getReaderAvatarSrc(reader, { prefer: 'original' }) : ''
}

async function copyCurrentLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    if (copiedTimer != null) window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => { copied.value = false }, 1800)
  } catch {
    copied.value = false
  }
}

function updatePageMetadata() {
  if (!post.value || !author.value) return
  const title = `${localizedTitle(post.value)} - E-Tomd`
  const description = localized(post.value.excerpt, post.value.excerptEn)
  applyDynamicDocumentMeta({
    title,
    description,
    image: getCardImageUrl(post.value.coverCardNameEn),
    type: 'article',
  })

  jsonLdElement?.remove()
  const script = document.createElement('script')
  script.id = 'blog-article-jsonld'
  script.type = 'application/ld+json'
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: localizedTitle(post.value),
    description,
    image: getCardImageUrl(post.value.coverCardNameEn),
    author: { '@type': 'Person', name: localized(author.value.name, author.value.nameEn) },
    datePublished: post.value.publishedAt,
    dateModified: post.value.updatedAt,
    mainEntityOfPage: window.location.href,
  })
  document.head.appendChild(script)
  jsonLdElement = script
}

onMounted(() => {
  if (!post.value) {
    void router.replace('/blog')
    return
  }
  updatePageMetadata()
})

watch([post, locale], updatePageMetadata)

onUnmounted(() => {
  if (copiedTimer != null) window.clearTimeout(copiedTimer)
  copiedTimer = null
  jsonLdElement?.remove()
  jsonLdElement = null
})
</script>

<template>
  <article v-if="post && author" class="article-page relative z-10">
    <header class="article-header article-shell">
      <RouterLink to="/blog" class="article-back">
        <ArrowLeft :size="17" aria-hidden="true" />
        <span>{{ copy.back }}</span>
      </RouterLink>

      <div class="article-category">{{ localized(post.tags[0] ?? '', post.tagsEn[0] ?? '') }}</div>
      <h1>{{ localizedTitle(post) }}</h1>
      <p class="article-deck">{{ localized(post.excerpt, post.excerptEn) }}</p>

      <div class="article-meta-row">
        <div class="article-author-compact">
          <div class="article-avatar" aria-hidden="true">
            <img v-if="authorAvatar(author)" :src="authorAvatar(author)" alt="" />
            <span v-else>{{ author.fallbackMark }}</span>
          </div>
          <div>
            <strong>{{ localized(author.name, author.nameEn) }}</strong>
            <small>{{ localized(author.role, author.roleEn) }}</small>
          </div>
        </div>
        <div class="article-time-meta">
          <span>{{ formattedDate(post.publishedAt) }}</span>
          <span><Clock :size="14" aria-hidden="true" />{{ post.readingMinutes }} {{ copy.minRead }}</span>
        </div>
      </div>
    </header>

    <figure class="article-cover article-wide">
      <img :src="getCardImageUrl(post.coverCardNameEn)" :alt="localized(post.coverAlt, post.coverAltEn)" />
    </figure>

    <div class="article-layout article-wide">
      <aside class="article-aside">
        <nav v-if="headings.length" class="article-toc" :aria-label="copy.toc">
          <strong>{{ copy.toc }}</strong>
          <a v-for="heading in headings" :key="heading.id" :href="`#${heading.id}`">
            {{ localized(heading.text, heading.textEn) }}
          </a>
        </nav>
        <button type="button" class="article-copy-link" @click="copyCurrentLink">
          <Check v-if="copied" :size="16" aria-hidden="true" />
          <Copy v-else :size="16" aria-hidden="true" />
          <span>{{ copied ? copy.copied : copy.copyLink }}</span>
        </button>
      </aside>

      <div class="article-content">
        <template v-for="(block, index) in post.blocks" :key="`${block.type}-${index}`">
          <h2 v-if="block.type === 'heading'" :id="block.id">{{ localized(block.text, block.textEn) }}</h2>
          <p v-else-if="block.type === 'paragraph'">{{ localized(block.text, block.textEn) }}</p>
          <ul v-else-if="block.type === 'list'">
            <li v-for="item in (isZh ? block.items : block.itemsEn)" :key="item">{{ item }}</li>
          </ul>
          <blockquote v-else-if="block.type === 'quote'">{{ localized(block.text, block.textEn) }}</blockquote>
          <section v-else-if="block.type === 'callout'" class="article-callout">
            <h3>{{ localized(block.title, block.titleEn) }}</h3>
            <p>{{ localized(block.text, block.textEn) }}</p>
          </section>
        </template>

        <p class="article-disclaimer">{{ copy.disclaimer }}</p>

        <section class="article-author-card" aria-labelledby="article-author-heading">
          <div class="article-avatar article-avatar-large" aria-hidden="true">
            <img v-if="authorAvatar(author)" :src="authorAvatar(author)" alt="" />
            <span v-else>{{ author.fallbackMark }}</span>
          </div>
          <div>
            <span>{{ copy.by }}</span>
            <h2 id="article-author-heading">{{ localized(author.name, author.nameEn) }}</h2>
            <p>{{ localized(author.bio, author.bioEn) }}</p>
            <div class="article-specialties">
              <span v-for="specialty in (isZh ? author.specialties : author.specialtiesEn)" :key="specialty">{{ specialty }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <section class="article-related article-wide" aria-labelledby="article-related-actions">
      <h2 id="article-related-actions">{{ copy.relatedActions }}</h2>
      <div class="article-action-grid">
        <RouterLink v-for="item in post.relatedRoutes" :key="item.to" :to="item.to">
          <div>
            <strong>{{ localized(item.label, item.labelEn) }}</strong>
            <p>{{ localized(item.description, item.descriptionEn) }}</p>
          </div>
          <ArrowRight :size="18" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <section class="article-more article-wide" aria-labelledby="article-related-reading">
      <h2 id="article-related-reading">{{ copy.relatedArticles }}</h2>
      <div class="article-more-list">
        <RouterLink v-for="item in relatedPosts" :key="item.slug" :to="`/blog/${item.slug}`">
          <span>{{ formattedDate(item.publishedAt) }}</span>
          <strong>{{ localizedTitle(item) }}</strong>
          <ArrowRight :size="17" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>
  </article>
</template>

<style scoped>
.article-page { color: rgba(232, 224, 212, .75); }
.article-shell { width: min(100% - 2rem, 49rem); margin-inline: auto; }
.article-wide { width: min(100% - 2rem, 70rem); margin-inline: auto; }
.article-header { padding-top: 3rem; }
.article-back { display: inline-flex; align-items: center; gap: .45rem; color: rgba(232, 224, 212, .48); font-size: .8rem; }
.article-back:hover { color: var(--color-gold-200); }
.article-category { margin-top: 3rem; color: rgba(212, 168, 83, .78); font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.article-header h1 { max-width: 22ch; margin-top: .85rem; color: #fff; font-family: var(--font-cinzel); font-size: clamp(2.25rem, 5.3vw, 4.2rem); font-weight: 700; letter-spacing: 0; line-height: 1.1; }
.article-deck { max-width: 43rem; margin-top: 1.35rem; color: rgba(232, 224, 212, .58); font-size: clamp(.98rem, 2vw, 1.12rem); line-height: 1.8; }
.article-meta-row { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid rgba(255, 255, 255, .08); }
.article-author-compact { display: flex; align-items: center; gap: .75rem; }
.article-author-compact strong { display: block; color: rgba(255, 255, 255, .9); font-size: .82rem; }
.article-author-compact small { display: block; margin-top: .15rem; color: rgba(232, 224, 212, .38); font-size: .7rem; }
.article-avatar { display: flex; width: 2.55rem; height: 2.55rem; flex: 0 0 auto; align-items: center; justify-content: center; overflow: hidden; border: 1px solid rgba(212, 168, 83, .22); border-radius: 50%; background: rgba(212, 168, 83, .08); color: var(--color-gold-200); font-family: var(--font-cinzel); }
.article-avatar img { width: 100%; height: 100%; object-fit: cover; }
.article-time-meta { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .45rem 1rem; color: rgba(232, 224, 212, .38); font-size: .72rem; }
.article-time-meta span:last-child { display: inline-flex; align-items: center; gap: .35rem; }
.article-cover { display: flex; min-height: 29rem; align-items: center; justify-content: center; margin-top: 3.4rem; overflow: hidden; border-radius: 7px; background: linear-gradient(150deg, rgba(92, 62, 119, .22), rgba(12, 7, 20, .92)); }
.article-cover img { width: min(37%, 16rem); max-height: 25rem; object-fit: contain; filter: drop-shadow(0 25px 42px rgba(0, 0, 0, .48)); }
.article-layout { display: grid; grid-template-columns: 13.5rem minmax(0, 43rem); justify-content: space-between; gap: 3.25rem; padding-top: 4rem; }
.article-aside { position: sticky; top: 6rem; align-self: start; }
.article-toc { display: grid; gap: .7rem; padding-left: .9rem; border-left: 1px solid rgba(212, 168, 83, .18); }
.article-toc strong { margin-bottom: .2rem; color: rgba(255, 255, 255, .74); font-size: .75rem; }
.article-toc a { color: rgba(232, 224, 212, .38); font-size: .72rem; line-height: 1.45; }
.article-toc a:hover { color: var(--color-gold-200); }
.article-copy-link { display: inline-flex; min-height: 2.25rem; align-items: center; gap: .45rem; margin-top: 1.25rem; padding: .35rem .7rem; border: 1px solid rgba(255, 255, 255, .08); border-radius: 7px; color: rgba(232, 224, 212, .48); font-size: .72rem; }
.article-copy-link:hover { border-color: rgba(212, 168, 83, .25); color: var(--color-gold-200); }
.article-content { min-width: 0; color: rgba(232, 224, 212, .72); font-size: 1rem; line-height: 1.95; }
.article-content > p { margin-top: 1.25rem; }
.article-content > p:first-child { margin-top: 0; color: rgba(232, 224, 212, .85); font-size: 1.08rem; }
.article-content h2 { scroll-margin-top: 6rem; margin-top: 3.2rem; color: #fff; font-family: var(--font-cinzel); font-size: clamp(1.35rem, 2.5vw, 1.8rem); font-weight: 700; letter-spacing: 0; line-height: 1.35; }
.article-content ul { display: grid; gap: .65rem; margin-top: 1.35rem; padding-left: 1.25rem; list-style: disc; }
.article-content li { padding-left: .3rem; }
.article-content li::marker { color: rgba(212, 168, 83, .72); }
.article-content blockquote { margin: 2.5rem 0 0; padding: .3rem 0 .3rem 1.25rem; border-left: 2px solid rgba(212, 168, 83, .55); color: var(--color-gold-100); font-family: var(--font-cinzel); font-size: 1.2rem; line-height: 1.7; }
.article-callout { margin-top: 2.5rem; padding: 1.35rem 1.45rem; border: 1px solid rgba(212, 168, 83, .16); border-radius: 7px; background: rgba(212, 168, 83, .055); }
.article-callout h3 { color: var(--color-gold-200); font-size: .9rem; font-weight: 700; }
.article-callout p { margin-top: .45rem; color: rgba(232, 224, 212, .62); font-size: .88rem; line-height: 1.75; }
.article-disclaimer { margin-top: 3rem !important; padding-top: 1.25rem; border-top: 1px solid rgba(255, 255, 255, .07); color: rgba(232, 224, 212, .34); font-size: .72rem; line-height: 1.7; }
.article-author-card { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1.2rem; margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(255, 255, 255, .08); }
.article-avatar-large { width: 4.25rem; height: 4.25rem; font-size: 1.2rem; }
.article-author-card > div:last-child > span { color: rgba(212, 168, 83, .66); font-size: .68rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.article-author-card h2 { margin-top: .2rem; font-size: 1.25rem; }
.article-author-card p { margin-top: .45rem; color: rgba(232, 224, 212, .52); font-size: .82rem; line-height: 1.7; }
.article-specialties { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .8rem; }
.article-specialties span { padding: .25rem .5rem; border-radius: 5px; background: rgba(255, 255, 255, .04); color: rgba(232, 224, 212, .46); font-size: .68rem; }
.article-related, .article-more { padding-top: 5.5rem; }
.article-related > h2, .article-more > h2 { color: #fff; font-family: var(--font-cinzel); font-size: 1.45rem; font-weight: 700; }
.article-action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 1.2rem; }
.article-action-grid > a { display: flex; min-height: 7.5rem; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.2rem; border: 1px solid rgba(212, 168, 83, .14); border-radius: 7px; background: rgba(21, 12, 32, .72); }
.article-action-grid > a:hover { border-color: rgba(212, 168, 83, .38); }
.article-action-grid strong { color: var(--color-gold-100); font-size: .9rem; }
.article-action-grid p { margin-top: .35rem; color: rgba(232, 224, 212, .42); font-size: .75rem; line-height: 1.55; }
.article-action-grid svg { flex: 0 0 auto; color: var(--color-gold-300); }
.article-more { padding-bottom: 6rem; }
.article-more-list { margin-top: 1rem; }
.article-more-list > a { display: grid; grid-template-columns: 7rem minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding: 1.25rem 0; border-top: 1px solid rgba(255, 255, 255, .07); }
.article-more-list > a:last-child { border-bottom: 1px solid rgba(255, 255, 255, .07); }
.article-more-list span { color: rgba(232, 224, 212, .35); font-size: .7rem; }
.article-more-list strong { color: rgba(255, 255, 255, .82); font-family: var(--font-cinzel); font-size: .95rem; }
.article-more-list > a:hover strong { color: var(--color-gold-200); }
.article-more-list svg { color: rgba(212, 168, 83, .65); }

@media (max-width: 850px) {
  .article-layout { grid-template-columns: 1fr; gap: 2rem; }
  .article-aside { position: static; }
  .article-toc { display: none; }
  .article-copy-link { margin-top: 0; }
}

@media (max-width: 640px) {
  .article-shell, .article-wide { width: min(100% - 1.25rem, 49rem); }
  .article-category { margin-top: 2.2rem; }
  .article-meta-row { align-items: flex-start; flex-direction: column; gap: .9rem; }
  .article-time-meta { justify-content: flex-start; }
  .article-cover { min-height: 21rem; margin-top: 2.5rem; }
  .article-cover img { width: min(55%, 12rem); }
  .article-layout { padding-top: 2.5rem; }
  .article-content { font-size: .95rem; line-height: 1.9; }
  .article-action-grid { grid-template-columns: 1fr; }
  .article-more-list > a { grid-template-columns: 1fr auto; }
  .article-more-list span { grid-column: 1 / -1; }
}
</style>
