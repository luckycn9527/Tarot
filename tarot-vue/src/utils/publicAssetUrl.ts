/**
 * 将站内相对资源路径转为浏览器可请求的 URL。
 *
 * 开发环境（Vite）：对以 `/` 开头的路径保持相对 URL，由 dev server 代理 `/uploads`、`/api`，
 * 与页面同源，避免 img 直接请求另一端口上的后端静态资源触发 Cross-Origin-Resource-Policy 导致的
 * net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin。
 *
 * 生产：若静态站与 API 不同源，可设 VITE_PUBLIC_API_ORIGIN；同源部署则保持相对路径即可。
 *
 * 注意：`/uploads/...` 是用户头像、塔罗师头像、牌背等动态上传资源，默认应走当前站点
 * 的 `/uploads` 反代。只有明确设置 VITE_PUBLIC_UPLOADS_ORIGIN 时才改到独立资源域。
 */
const DEFAULT_OSS_ASSET_ORIGIN = 'https://tarot-1.oss-cn-hangzhou.aliyuncs.com'

export const PUBLIC_OSS_ASSET_ORIGIN = (
  (import.meta.env.VITE_PUBLIC_OSS_ORIGIN as string | undefined) || DEFAULT_OSS_ASSET_ORIGIN
).replace(/\/$/, '')

const PUBLIC_UPLOADS_ORIGIN = (import.meta.env.VITE_PUBLIC_UPLOADS_ORIGIN as string | undefined)?.replace(/\/$/, '')
let uploadFallbackInstalled = false

export function ossAssetUrl(path: string): string {
  const s = String(path).trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return `${PUBLIC_OSS_ASSET_ORIGIN}/${s.replace(/^\/+/, '')}`
}

export function publicAssetUrl(relative: string | null | undefined): string {
  if (relative == null || relative === '') return ''
  const s = String(relative).trim()
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/uploads/')) return PUBLIC_UPLOADS_ORIGIN ? `${PUBLIC_UPLOADS_ORIGIN}${s}` : s
  if (import.meta.env.DEV && s.startsWith('/')) return s
  const origin = (import.meta.env.VITE_PUBLIC_API_ORIGIN as string | undefined)?.replace(/\/$/, '')
  if (origin && s.startsWith('/')) return `${origin}${s}`
  return s
}

export function installUploadImageFallback(): void {
  if (uploadFallbackInstalled || typeof window === 'undefined' || !PUBLIC_UPLOADS_ORIGIN) return
  uploadFallbackInstalled = true

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target
      if (!(target instanceof HTMLImageElement)) return

      const src = target.currentSrc || target.src
      if (!src || !src.startsWith(`${PUBLIC_UPLOADS_ORIGIN}/uploads/`)) return
      if (target.dataset.uploadFallbackTried === '1') return

      try {
        const url = new URL(src)
        target.dataset.uploadFallbackTried = '1'
        target.src = `${url.pathname}${url.search}${url.hash}`
      } catch {
        // Keep the original broken URL if the browser reports an unexpected src.
      }
    },
    true,
  )
}
