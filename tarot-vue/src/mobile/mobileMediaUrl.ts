/** Keep externally hosted media on its original host; only root paths use the site origin. */
export function resolveMobileMediaUrl(value: string | null | undefined, origin: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value || /[\u0000-\u0020\u007f\\]/.test(value)) return ''
  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value)
      return url.hostname && !url.username && !url.password ? value : ''
    }
    if (!value.startsWith('/') || value.startsWith('//')) return ''
    const base = new URL(origin)
    if (!['http:', 'https:'].includes(base.protocol) || !base.hostname || base.username || base.password) return ''
    const url = new URL(value, base.origin)
    return url.origin === base.origin ? url.href : ''
  } catch { return '' }
}
