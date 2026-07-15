import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
})

const ACCESS_TOKEN_KEY = 'tarot_access_token'
const REMEMBER_LOGIN_KEY = 'tarot_remember_login'

// “记住我”使用 localStorage；未勾选时仅保存在当前标签页的 sessionStorage。
let rememberLogin = localStorage.getItem(REMEMBER_LOGIN_KEY) === 'true'
const localToken = localStorage.getItem(ACCESS_TOKEN_KEY)
const sessionToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
let accessToken: string | null = localToken || sessionToken
if (localToken) rememberLogin = true

export function getRememberLogin(): boolean {
  return rememberLogin
}

export function setAccessToken(token: string | null, persist = rememberLogin) {
  accessToken = token
  if (token) {
    rememberLogin = persist
    if (persist) {
      localStorage.setItem(REMEMBER_LOGIN_KEY, 'true')
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
      sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    } else {
      localStorage.removeItem(REMEMBER_LOGIN_KEY)
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
    }
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}

// 请求拦截器：添加 Authorization header
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// 响应拦截器：自动刷新 token
let isRefreshing = false
/** 等待刷新完成的请求队列：成功时用新 token 重试，失败时一并 reject，避免请求永久挂起 */
interface PendingRequest {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}
let pendingRequests: PendingRequest[] = []

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // 如果是 401 且不是刷新请求本身
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
      originalRequest._retry = true

      if (!isRefreshing) {
        isRefreshing = true
        try {
          const res = await axios.post('/api/auth/refresh', null, { withCredentials: true })
          const newToken = res.data.data.accessToken
          setAccessToken(newToken)

          // 重试所有等待的请求
          pendingRequests.forEach(({ resolve }) => resolve(newToken))
          pendingRequests = []

          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        } catch (refreshErr) {
          // 刷新失败，清除状态并 reject 所有等待中的请求（否则它们会永久挂起）
          setAccessToken(null)
          pendingRequests.forEach(({ reject }) => reject(refreshErr))
          pendingRequests = []
          // 触发全局登出事件
          window.dispatchEvent(new CustomEvent('auth:logout'))
          return Promise.reject(error)
        } finally {
          isRefreshing = false
        }
      }

      // 如果正在刷新中，等待刷新完成（成功则重试，失败则 reject）
      return new Promise((resolve, reject) => {
        pendingRequests.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          },
          reject,
        })
      })
    }

    return Promise.reject(error)
  }
)

export default api
