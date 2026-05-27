import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
})

// Access token 存储
let accessToken: string | null = localStorage.getItem('tarot_access_token')

export function setAccessToken(token: string | null) {
  accessToken = token
  if (token) {
    localStorage.setItem('tarot_access_token', token)
  } else {
    localStorage.removeItem('tarot_access_token')
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
let pendingRequests: ((token: string) => void)[] = []

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
          pendingRequests.forEach((cb) => cb(newToken))
          pendingRequests = []

          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        } catch {
          // 刷新失败，清除状态
          setAccessToken(null)
          pendingRequests = []
          // 触发全局登出事件
          window.dispatchEvent(new CustomEvent('auth:logout'))
          return Promise.reject(error)
        } finally {
          isRefreshing = false
        }
      }

      // 如果正在刷新中，等待刷新完成
      return new Promise((resolve) => {
        pendingRequests.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(api(originalRequest))
        })
      })
    }

    return Promise.reject(error)
  }
)

export default api
