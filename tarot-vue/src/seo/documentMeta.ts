import type { RouteLocationNormalized } from 'vue-router'
import { i18n } from '@/i18n'

const DEFAULT_OG = 'https://cdn.tarotqa.com/images-optimized/landing/Yes-No-Single-Card.webp'

function setMetaAttr(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** 生产环境可设 `VITE_PUBLIC_APP_ORIGIN`（无尾斜杠），便于 canonical/og:url 与部署域名一致 */
function siteOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_APP_ORIGIN
  if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function resolveCanonicalUrl(to: RouteLocationNormalized): string | null {
  const origin = siteOrigin()
  if (!origin) return null
  try {
    const path = to.path && to.path.startsWith('/') ? to.path : `/${to.path || ''}`
    return new URL(path, `${origin}/`).href
  } catch {
    return null
  }
}

/** 卡片详情、运势结果等动态标题；与 `applyRouteDocumentMeta` 配合使用 */
export function applyDynamicDocumentMeta(opts: { title: string; description?: string }) {
  document.title = opts.title
  setMetaProperty('og:title', opts.title)
  setMetaAttr('twitter:title', opts.title)
  if (opts.description) {
    setMetaAttr('description', opts.description)
    setMetaProperty('og:description', opts.description)
    setMetaAttr('twitter:description', opts.description)
  }
}

export function applyRouteDocumentMeta(to: RouteLocationNormalized) {
  const g = i18n.global
  const name = to.name != null ? String(to.name) : ''
  const tk = name ? `seo.titles.${name}` : ''
  const title =
    tk && g.te(tk) ? `${String(g.t(tk))} — E-Tomd` : 'E-Tomd'

  document.title = title

  const descKey = to.meta.seoDescKey
  const desc =
    descKey && typeof descKey === 'string' && g.te(descKey)
      ? String(g.t(descKey))
      : String(g.t('seo.defaultDesc'))

  setMetaAttr('description', desc)
  setMetaProperty('og:title', title)
  setMetaProperty('og:description', desc)
  setMetaProperty('og:type', 'website')
  setMetaProperty('og:image', DEFAULT_OG)

  const canonical = resolveCanonicalUrl(to)
  if (canonical) {
    setCanonical(canonical)
    setMetaProperty('og:url', canonical)
  }

  setMetaAttr('twitter:card', 'summary_large_image')
  setMetaAttr('twitter:title', title)
  setMetaAttr('twitter:description', desc)
  setMetaAttr('twitter:image', DEFAULT_OG)
}
