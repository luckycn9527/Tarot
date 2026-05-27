/**
 * 将站内相对资源路径转为浏览器可请求的 URL。
 *
 * 开发环境（Vite）：对以 `/` 开头的路径保持相对 URL，由 dev server 代理 `/uploads`、`/api`，
 * 与页面同源，避免 img 直接请求另一端口上的后端静态资源触发 Cross-Origin-Resource-Policy 导致的
 * net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin。
 *
 * 生产：若静态站与 API 不同源，可设 VITE_PUBLIC_API_ORIGIN；同源部署则保持相对路径即可。
 */
export function publicAssetUrl(relative: string | null | undefined): string {
  if (relative == null || relative === '') return ''
  const s = String(relative).trim()
  if (/^https?:\/\//i.test(s)) return s
  if (import.meta.env.DEV && s.startsWith('/')) return s
  const origin = (import.meta.env.VITE_PUBLIC_API_ORIGIN as string | undefined)?.replace(/\/$/, '')
  if (origin && s.startsWith('/')) return `${origin}${s}`
  return s
}
