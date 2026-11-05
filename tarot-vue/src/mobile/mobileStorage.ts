import { Capacitor } from '@capacitor/core'
import { SecureStorage, KeychainAccess } from '@aparajita/capacitor-secure-storage'

export const mobileSite = import.meta.env.VITE_MOBILE_SITE === 'overseas' ? 'overseas' : 'domestic'
const prefix = `etomd-mobile-v1-${mobileSite}:`
let ready: Promise<void> | null = null
let writes: Promise<unknown> = Promise.resolve()
function initialize() {
  if (!ready) ready = (async () => {
    if (!Capacitor.isNativePlatform()) return
    await SecureStorage.setKeyPrefix(prefix)
    await SecureStorage.setSynchronize(false)
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly)
  })().catch(error => { ready = null; throw error })
  return ready
}
export async function readMobileValue<T>(key: string): Promise<T | null> {
  await initialize(); await writes.catch(() => {})
  const raw = Capacitor.isNativePlatform() ? await SecureStorage.get(key, false, false) : sessionStorage.getItem(prefix + key)
  if (raw === null || raw === undefined) return null
  try { return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T } catch { return null }
}
export function writeMobileValue(key: string, value: unknown): Promise<void> {
  const operation = writes.catch(() => {}).then(async () => {
    await initialize()
    if (value === null) {
      if (Capacitor.isNativePlatform()) await SecureStorage.remove(key, false)
      else sessionStorage.removeItem(prefix + key)
    } else {
      const serialized = JSON.stringify(value)
      if (Capacitor.isNativePlatform()) await SecureStorage.set(key, serialized)
      else sessionStorage.setItem(prefix + key, serialized)
    }
  })
  writes = operation
  return operation
}
