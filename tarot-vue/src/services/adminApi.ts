import axios from 'axios'
import router from '../router'

const adminApi = axios.create({
  baseURL: '/api/admin',
  timeout: 30000,
})

let adminToken: string | null = localStorage.getItem('admin_access_token')

export function setAdminToken(token: string | null) {
  adminToken = token
  if (token) localStorage.setItem('admin_access_token', token)
  else localStorage.removeItem('admin_access_token')
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
