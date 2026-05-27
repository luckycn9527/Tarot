import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 需要已登录用户 */
    requiresAuth?: boolean
    /** 仅访客（已登录则回首页） */
    guestOnly?: boolean
    /** 管理后台 */
    adminOnly?: boolean
    /** i18n 键，用于 SEO 标题（见 locales/zh-CN.ts `seo.*`） */
    seoTitleKey?: string
    /** SEO 描述键 */
    seoDescKey?: string
  }
}
