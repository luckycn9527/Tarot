/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOBILE_APP?: string
  readonly VITE_MOBILE_SITE?: 'domestic' | 'overseas'
  readonly VITE_PUBLIC_API_BASE_URL?: string
  readonly VITE_PUBLIC_API_ORIGIN?: string
  /** 站点根 URL（canonical / og:url）；不设则用 `window.location.origin` */
  readonly VITE_PUBLIC_APP_ORIGIN?: string
  /** First-visit locale, useful for a dedicated overseas deployment. */
  readonly VITE_DEFAULT_LOCALE?: 'zh-CN' | 'en-US'
  /** Set to disabled for a site that should keep membership checkout closed. */
  readonly VITE_PAYMENT_MODE?: 'auto' | 'disabled'
  /** Google OAuth Web Client ID（与后端 GOOGLE_CLIENT_ID 一致） */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Creem/KYC 对应的公开法律实体名称 */
  readonly VITE_LEGAL_ENTITY_NAME?: string
  /** 法律实体的公开联系地址 */
  readonly VITE_LEGAL_ENTITY_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
