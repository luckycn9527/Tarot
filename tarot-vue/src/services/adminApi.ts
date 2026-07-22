import axios from 'axios'
import router from '../router'

const configuredApiBaseUrl = import.meta.env.VITE_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '')
const configuredApiOrigin = import.meta.env.VITE_PUBLIC_API_ORIGIN?.trim().replace(/\/+$/, '')
const adminApiBaseUrl = `${configuredApiBaseUrl || (import.meta.env.PROD && configuredApiOrigin ? `${configuredApiOrigin}/api` : '/api')}/admin`

const adminApi = axios.create({
  baseURL: adminApiBaseUrl,
  timeout: 30000,
})

const ADMIN_TOKEN_KEY = 'admin_access_token'

// 管理员凭证仅保留在当前标签页，清除旧版本可能留下的持久化令牌。
localStorage.removeItem(ADMIN_TOKEN_KEY)

let adminToken: string | null = sessionStorage.getItem(ADMIN_TOKEN_KEY)

export function setAdminToken(token: string | null) {
  adminToken = token
  if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY)
}

export function getAdminToken() {
  return adminToken
}

adminApi.interceptors.request.use((config) => {
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`
  }
  return config
})

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      setAdminToken(null)
      void router.replace('/admin/login')
    }
    return Promise.reject(err)
  },
)

export default adminApi
