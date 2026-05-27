import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api, { setAccessToken } from '@/services/api'
import { useUserResourcesStore } from '@/stores/userResources'
import { useCemeteryStore } from '@/stores/cemetery'

export interface User {
  id: number
  email: string
  nickname: string
  avatar: string
  gender: string
  birthday: string | null
  zodiacSign: string | null
  location: string | null
  bio: string | null
  membership: 'free' | 'vip'
  membershipExpiresAt: string | null
  remainingFreeQuota: number
  createdAt: string
}

interface AuthError {
  field?: string
  message: string
}

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const isInitialized = ref(false)

  const user = computed(() => currentUser.value)
  const isLoggedIn = computed(() => currentUser.value !== null)

  async function fetchProfileFromApi(): Promise<void> {
    const res = await api.get('/user/profile')
    if (res.data.success) {
      currentUser.value = res.data.data
    }
  }

  async function initSession() {
    const token = localStorage.getItem('tarot_access_token')
    if (!token) {
      try {
        const refreshRes = await api.post('/auth/refresh')
        if (refreshRes.data.success) {
          setAccessToken(refreshRes.data.data.accessToken)
          currentUser.value = refreshRes.data.data.user
        }
      } catch {
        /* 无有效会话 */
      } finally {
        isInitialized.value = true
      }
    } else {
      try {
        await fetchProfileFromApi()
      } catch {
        try {
          const refreshRes = await api.post('/auth/refresh')
          if (refreshRes.data.success) {
            setAccessToken(refreshRes.data.data.accessToken)
            currentUser.value = refreshRes.data.data.user
          }
        } catch {
          setAccessToken(null)
        }
      } finally {
        isInitialized.value = true
      }
    }
    if (currentUser.value) {
      const ur = useUserResourcesStore()
      void ur.fetchQuota(true)
      void ur.fetchSettings(true)
    }
  }

  async function register(data: {
    nickname: string
    email: string
    password: string
    confirmPassword: string
  }): Promise<AuthError | null> {
    const { nickname, email, password, confirmPassword } = data

    if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 20) {
      return { field: 'nickname', message: '昵称长度需要2-20个字符' }
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      return { field: 'email', message: '请输入有效的邮箱地址' }
    }
    if (!password || password.length < 6) {
      return { field: 'password', message: '密码至少需要6个字符' }
    }
    if (password !== confirmPassword) {
      return { field: 'confirmPassword', message: '两次输入的密码不一致' }
    }

    try {
      const res = await api.post('/auth/register', {
        email,
        nickname: nickname.trim(),
        password,
      })
      if (res.data.success) {
        setAccessToken(res.data.data.accessToken)
        currentUser.value = res.data.data.user
        isInitialized.value = true
        const resources = useUserResourcesStore()
        resources.invalidateAll()
        void resources.fetchQuota(true)
        void resources.fetchSettings(true)
        return null
      }
      return { message: res.data.message || '注册失败' }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message || '注册失败，请稍后重试'
      return { message: msg }
    }
  }

  async function loginWithGoogle(idToken: string): Promise<AuthError | null> {
    try {
      const res = await api.post('/auth/google', { idToken })
      if (res.data.success) {
        setAccessToken(res.data.data.accessToken)
        currentUser.value = res.data.data.user
        isInitialized.value = true
        const resources = useUserResourcesStore()
        resources.invalidateAll()
        void resources.fetchQuota(true)
        void resources.fetchSettings(true)
        useCemeteryStore().clearUserScoped()
        return null
      }
      return { message: res.data.message || 'Google 登录失败' }
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { message?: string } } }
      const msg = ax.response?.data?.message || 'Google 登录失败'
      if (ax.response?.status === 503) {
        return { message: '本站暂未开启 Google 登录' }
      }
      return { message: msg }
    }
  }

  async function requestPasswordReset(email: string): Promise<{ ok: boolean; message: string }> {
    const emailTrimmed = email.trim()
    if (!emailTrimmed) {
      return { ok: false, message: '请输入邮箱' }
    }
    try {
      const res = await api.post('/auth/forgot-password', { email: emailTrimmed })
      if (res.data.success) {
        return { ok: true, message: res.data.message || '已发送' }
      }
      return { ok: false, message: res.data.message || '发送失败' }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message || '发送失败，请稍后重试'
      return { ok: false, message: msg }
    }
  }

  async function resetPasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword })
      if (res.data.success) {
        return { ok: true, message: res.data.message || '密码已重置' }
      }
      return { ok: false, message: res.data.message || '重置失败' }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message || '重置失败，请稍后重试'
      return { ok: false, message: msg }
    }
  }

  async function login(email: string, password: string): Promise<AuthError | null> {
    const emailTrimmed = email.trim()
    if (!emailTrimmed) return { field: 'email', message: '请输入邮箱' }
    if (!password) return { field: 'password', message: '请输入密码' }

    try {
      const res = await api.post('/auth/login', { email: emailTrimmed, password })
      if (res.data.success) {
        setAccessToken(res.data.data.accessToken)
        currentUser.value = res.data.data.user
        isInitialized.value = true
        const resources = useUserResourcesStore()
        resources.invalidateAll()
        void resources.fetchQuota(true)
        void resources.fetchSettings(true)
        useCemeteryStore().clearUserScoped()
        return null
      }
      return { message: res.data.message || '登录失败' }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message || '登录失败，请稍后重试'
      return { message: msg }
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    currentUser.value = null
    setAccessToken(null)
    useUserResourcesStore().invalidateAll()
    useCemeteryStore().clearUserScoped()
  }

  async function updateProfile(data: {
    nickname?: string
    avatar?: string
    gender?: string
    birthday?: string | null
    location?: string | null
    bio?: string | null
  }): Promise<AuthError | null> {
    if (!currentUser.value) return { message: '未登录' }

    if (data.nickname !== undefined) {
      if (data.nickname.trim().length < 2 || data.nickname.trim().length > 20) {
        return { field: 'nickname', message: '昵称长度需要2-20个字符' }
      }
    }

    try {
      const res = await api.put('/user/profile', data)
      if (res.data.success) {
        currentUser.value = res.data.data
        return null
      }
      return { message: res.data.message || '更新失败' }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message || '更新失败，请稍后重试'
      return { message: msg }
    }
  }

  async function changePassword(oldPassword: string, newPassword: string): Promise<AuthError | null> {
    try {
      const res = await api.put('/user/password', { oldPassword, newPassword })
      if (res.data.success) return null
      return { message: res.data.message || '修改失败' }
    } catch (err: unknown) {
      return { message: (err as { response?: { data?: { message?: string } } }).response?.data?.message || '修改失败' }
    }
  }

  async function uploadAvatar(file: File): Promise<AuthError | null> {
    if (!currentUser.value) return { message: '未登录' }
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      const res = await api.post('/user/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (res.data.success) {
        currentUser.value = res.data.data
        return null
      }
      return { message: res.data.message || '上传失败' }
    } catch (err: unknown) {
      return { message: (err as { response?: { data?: { message?: string } } }).response?.data?.message || '上传失败，请稍后重试' }
    }
  }

  async function refreshUser() {
    try {
      await fetchProfileFromApi()
    } catch {
      /* ignore */
    }
  }

  return {
    currentUser,
    isInitialized,
    user,
    isLoggedIn,
    initSession,
    register,
    login,
    loginWithGoogle,
    requestPasswordReset,
    resetPasswordWithToken,
    logout,
    updateProfile,
    uploadAvatar,
    changePassword,
    refreshUser,
  }
})
