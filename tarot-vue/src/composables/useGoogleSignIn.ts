/** Google Identity Services（GIS）加载与类型声明 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
          cancel: () => void
        }
      }
    }
  }
}

export function getGoogleClientId(): string | undefined {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google 脚本加载失败')), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.setAttribute('data-google-gsi', '1')
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google 脚本加载失败'))
    document.head.appendChild(s)
  })
}

export function cancelGoogleOneTap(): void {
  try {
    window.google?.accounts.id.cancel()
  } catch {
    /* ignore */
  }
}

export async function renderGoogleSignInButton(
  el: HTMLElement,
  onCredential: (idToken: string) => void,
): Promise<void> {
  const cid = getGoogleClientId()
  if (!cid) return
  el.replaceChildren()
  await loadGoogleIdentityScript()
  window.google!.accounts.id.initialize({
    client_id: cid,
    callback: (response) => onCredential(response.credential),
  })
  window.google!.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    width: 320,
  })
}
