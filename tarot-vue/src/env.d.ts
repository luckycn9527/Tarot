/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 站点根 URL（canonical / og:url）；不设则用 `window.location.origin` */
  readonly VITE_PUBLIC_APP_ORIGIN?: string
  /** Google OAuth Web Client ID（与后端 GOOGLE_CLIENT_ID 一致） */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
