import { storeToRefs } from 'pinia'
import { useAuthStore, type User } from '@/stores/auth'

export type { User }

/** 认证与用户信息：状态在 Pinia，避免多处以模块单例重复维护 */
export function useAuth() {
  const s = useAuthStore()
  const { isInitialized, user, isLoggedIn } = storeToRefs(s)
  return {
    user,
    isLoggedIn,
    isInitialized,
    register: s.register,
    login: s.login,
    loginWithGoogle: s.loginWithGoogle,
    requestPasswordReset: s.requestPasswordReset,
    resetPasswordWithToken: s.resetPasswordWithToken,
    logout: s.logout,
    updateProfile: s.updateProfile,
    uploadAvatar: s.uploadAvatar,
    changePassword: s.changePassword,
    refreshUser: s.refreshUser,
  }
}
