import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { MotionPlugin } from '@vueuse/motion'
import App from './App.vue'
import router from './router'
import './assets/styles.css'
import { useAuthStore } from './stores/auth'
import { useUserResourcesStore } from './stores/userResources'
import { useCemeteryStore } from './stores/cemetery'
import { loadReferenceBundle } from './services/referenceBootstrap'
import { i18n } from './i18n'
import { applyLocaleToDocument } from './utils/localeStorage'
import { useToast } from './composables/useToast'

const pinia = createPinia()
const isAdminRoute = window.location.pathname.startsWith('/admin')

function showBootstrapError(message: string) {
  const el = document.getElementById('app')
  if (el) {
    el.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0f;color:#f3f4f6;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
        <div>
          <h1 style="font-size:24px;margin-bottom:12px;">初始化失败</h1>
          <p style="opacity:.85;line-height:1.7;">${message}</p>
        </div>
      </div>
    `
  }
}

async function bootstrap() {
  if (!isAdminRoute) {
    try {
      await loadReferenceBundle()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '无法加载基础数据，请稍后重试。'
      console.error('Failed to load reference bundle:', msg)
      showBootstrapError('无法加载基础数据，请稍后重试。')
      return
    }
  }

  const app = createApp(App)
  app.use(pinia)

  if (!isAdminRoute) {
    await useAuthStore().initSession()
  }

  app.use(i18n)
  applyLocaleToDocument(String(i18n.global.locale.value))
  app.use(router)
  app.use(MotionPlugin, {
    directives: {
      'fade-oracle': {
        initial: { opacity: 0, y: 20 },
        visibleOnce: { opacity: 1, y: 0, transition: { duration: 600, ease: 'easeOut' } },
      },
      'slide-mystic': {
        initial: { opacity: 0, x: -30 },
        visibleOnce: { opacity: 1, x: 0, transition: { duration: 500, ease: 'easeOut' } },
      },
      'scale-reveal': {
        initial: { opacity: 0, scale: 0.9 },
        visibleOnce: { opacity: 1, scale: 1, transition: { duration: 500, type: 'spring', damping: 15 } },
      },
    },
  })

  const toast = useToast()
  app.config.errorHandler = (err, instance, info) => {
    console.error('[vue]', err, info, instance)
    toast.error(String(i18n.global.t('errors.generic')))
  }

  window.addEventListener('auth:logout', () => {
    const authStore = useAuthStore()
    authStore.currentUser = null
    useUserResourcesStore().invalidateAll()
    useCemeteryStore().clearUserScoped()
  })

  app.mount('#app')
}

void bootstrap()
