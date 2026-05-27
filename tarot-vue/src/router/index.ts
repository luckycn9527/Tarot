import { createRouter, createWebHistory } from 'vue-router'
import { getAdminToken } from '../services/adminApi'
import { useAuthStore } from '@/stores/auth'
import { applyRouteDocumentMeta } from '@/seo/documentMeta'
import { i18n } from '@/i18n'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    { path: '/tarot', name: 'tarot', component: () => import('../views/TarotView.vue') },
    { path: '/daily-fortune', name: 'daily-fortune', component: () => import('../views/DailyFortuneView.vue') },
    { path: '/daily-fortune/result', name: 'daily-fortune-result', component: () => import('../views/DailyFortuneResult.vue') },
    { path: '/yes-no-tarot', name: 'yes-no-tarot', component: () => import('../views/YesNoTarotView.vue') },
    { path: '/yes-no-tarot/single-card', name: 'yes-no-single', component: () => import('../views/YesNoSingleCard.vue') },
    { path: '/yes-no-tarot/single-card/result', name: 'yes-no-single-result', component: () => import('../views/YesNoSingleCardResult.vue') },
    { path: '/yes-no-tarot/three-cards', name: 'yes-no-three', component: () => import('../views/YesNoThreeCards.vue') },
    { path: '/yes-no-tarot/three-cards/result', name: 'yes-no-three-result', component: () => import('../views/YesNoThreeCardsResult.vue') },
    { path: '/horoscope', name: 'horoscope', component: () => import('../views/HoroscopeView.vue') },
    {
      path: '/fate-dual',
      name: 'fate-dual',
      meta: { requiresAuth: true },
      component: () => import('../views/FateDualView.vue'),
    },
    {
      path: '/fate-dual/history',
      name: 'fate-dual-history',
      meta: { requiresAuth: true },
      component: () => import('../views/FateDualHistoryView.vue'),
    },
    {
      path: '/membership',
      name: 'membership',
      meta: { requiresAuth: true },
      component: () => import('../views/MembershipView.vue'),
    },
    { path: '/login', name: 'login', meta: { guestOnly: true }, component: () => import('../views/LoginView.vue') },
    { path: '/register', name: 'register', meta: { guestOnly: true }, component: () => import('../views/RegisterView.vue') },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      meta: { guestOnly: true },
      component: () => import('../views/ForgotPasswordView.vue'),
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      meta: { guestOnly: true },
      component: () => import('../views/ResetPasswordView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      meta: { requiresAuth: true },
      component: () => import('../views/ProfileView.vue'),
    },
    { path: '/privacy', name: 'privacy', component: () => import('../views/PrivacyView.vue') },
    { path: '/terms', name: 'terms', component: () => import('../views/TermsView.vue') },
    { path: '/feedback', name: 'feedback', component: () => import('../views/FeedbackView.vue') },
    { path: '/gallery', name: 'gallery', component: () => import('../views/GalleryView.vue') },
    { path: '/gallery/card/:slug', name: 'card-detail', component: () => import('../views/CardDetailView.vue') },
    { path: '/spreads', name: 'spreads', component: () => import('../views/SpreadsView.vue') },
    { path: '/oracle-gallery', name: 'oracle-gallery', component: () => import('../views/OracleGalleryView.vue') },
    {
      path: '/history',
      name: 'history',
      meta: { requiresAuth: true },
      component: () => import('../views/HistoryView.vue'),
    },
    {
      path: '/card-back-settings',
      name: 'card-back-settings',
      meta: { requiresAuth: true },
      component: () => import('../views/CardBackSettingsView.vue'),
    },
    {
      path: '/reader/:readerId/ask',
      name: 'reader-ask',
      meta: { requiresAuth: true },
      component: () => import('../views/reader/AskQuestionView.vue'),
    },
    {
      path: '/reader/:readerId/spread',
      name: 'reader-spread',
      meta: { requiresAuth: true },
      component: () => import('../views/reader/SpreadSelectView.vue'),
    },
    {
      path: '/reader/:readerId/reading',
      name: 'reader-reading',
      meta: { requiresAuth: true },
      component: () => import('../views/reader/ReaderReadingView.vue'),
    },
    { path: '/cemetery', name: 'cemetery', component: () => import('../views/CemeteryView.vue') },
    {
      path: '/cemetery/create',
      name: 'cemetery-create',
      meta: { requiresAuth: true },
      component: () => import('../views/CemeteryDivinationView.vue'),
    },
    { path: '/admin/login', name: 'admin-login', component: () => import('../views/admin/AdminLoginView.vue') },
    { path: '/admin', name: 'admin-dashboard', component: () => import('../views/admin/AdminDashboardView.vue'), meta: { adminOnly: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue') },
  ],
})

router.beforeEach((to) => {
  if (to.meta.adminOnly && !getAdminToken()) {
    return '/admin/login'
  }

  if (to.path.startsWith('/admin')) {
    return true
  }

  const auth = useAuthStore()
  if (!auth.isInitialized) {
    return true
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && auth.isLoggedIn) {
    return '/'
  }

  return true
})

router.afterEach((to) => {
  applyRouteDocumentMeta(to)
})

router.onError((error) => {
  const msg = error?.message || ''
  if (
    msg.includes('Failed to fetch dynamically imported module')
    || msg.includes('Importing a module script failed')
    || msg.includes('error loading dynamically imported module')
  ) {
    console.warn('[router] chunk load failed, suggest reload', error)
    if (typeof window !== 'undefined' && !sessionStorage.getItem('etomd_chunk_reload_prompt')) {
      sessionStorage.setItem('etomd_chunk_reload_prompt', '1')
      const hint = String(i18n.global.t('errors.chunkLoad'))
      const ok = window.confirm(`${hint}\n\n是否立即刷新页面？`)
      if (ok) window.location.reload()
    }
  }
})

export default router
