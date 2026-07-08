import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/styles.css'
import { useAuthStore } from './stores/auth'
import { useUserResourcesStore } from './stores/userResources'
import { loadReferenceBundle } from './services/referenceBootstrap'
import { i18n } from './i18n'
import { applyLocaleToDocument } from './utils/localeStorage'
import { useToast } from './composables/useToast'
import { installUploadImageFallback } from './utils/publicAssetUrl'

const pinia = createPinia()
// 提前激活 pinia，使 store 在 mount 前即可用（支持并行预取会话）
setActivePinia(pinia)
installUploadImageFallback()
const isAdminRoute = window.location.pathname.startsWith('/admin')

function showBootstrapError(message: string) {
  const el = document.getElementById('app')
  if (el) {
    const title = String(i18n.global.t('errors.bootstrapTitle'))
    el.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0f;color:#f3f4f6;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
        <div>
          <h1 style="font-size:24px;margin-bottom:12px;">${title}</h1>
          <p style="opacity:.85;line-height:1.7;">${message}</p>
        </div>
      </div>
    `
  }
}

async function bootstrap() {
  if (!isAdminRoute) {
    // 并行发起：基础数据（必需）与会话恢复（尽力而为），避免两次串行网络往返叠加到首屏 TTI
    const referencePromise = loadReferenceBundle()
    const sessionPromise = useAuthStore()
      .initSession()
      .catch((e) => {
        // 会话恢复失败不应阻断应用（以游客身份继续）
        console.warn('initSession failed, continuing as guest:', e)
      })

    try {
      await referencePromise
    } catch (e) {
      const fallback = String(i18n.global.t('errors.bootstrapBody'))
      const msg = e instanceof Error ? e.message : fallback
      console.error('Failed to load reference bundle:', msg)
      showBootstrapError(fallback)
      return
    }
    // 等待会话恢复完成后再 mount，保证路由守卫读取到正确的登录态
    await sessionPromise
  }

  const app = createApp(App)
  app.use(pinia)

  app.use(i18n)
  applyLocaleToDocument(String(i18n.global.locale.value))
  app.use(router)

  const toast = useToast()
  app.config.errorHandler = (err, instance, info) => {
    console.error('[vue]', err, info, instance)
    toast.error(String(i18n.global.t('errors.generic')))
  }

  window.addEventListener('auth:logout', () => {
    const authStore = useAuthStore()
    authStore.currentUser = null
    useUserResourcesStore().invalidateAll()
  })

  app.mount('#app')
}

void bootstrap()
