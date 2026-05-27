import { ref, shallowRef, type ShallowRef } from 'vue'

type Key = string

interface CacheEntry<T> {
  data: T
  fetchedAt: number
}

const globalCache = new Map<Key, CacheEntry<unknown>>()

export interface UseAsyncDataOptions {
  /** 毫秒；默认 30s 内不重复请求 */
  staleTime?: number
  /** 立即执行 */
  immediate?: boolean
}

/**
 * 轻量「服务端状态」缓存：同 key 在 staleTime 内复用结果，减少重复打接口。
 */
export function useAsyncData<T>(
  key: Key,
  fetcher: () => Promise<T>,
  options: UseAsyncDataOptions = {},
) {
  const staleTime = options.staleTime ?? 30_000
  const immediate = options.immediate ?? true

  const data = shallowRef<T | null>(null) as ShallowRef<T | null>
  const error = ref<Error | null>(null)
  const loading = ref(false)

  async function execute(force = false) {
    const now = Date.now()
    if (!force) {
      const hit = globalCache.get(key) as CacheEntry<T> | undefined
      if (hit && now - hit.fetchedAt < staleTime) {
        data.value = hit.data
        error.value = null
        return hit.data
      }
    }

    loading.value = true
    error.value = null
    try {
      const result = await fetcher()
      globalCache.set(key, { data: result, fetchedAt: Date.now() })
      data.value = result
      return result
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function invalidate() {
    globalCache.delete(key)
    data.value = null
  }

  if (immediate) {
    void execute()
  }

  return {
    data: data as ShallowRef<T | null>,
    error,
    loading,
    execute,
    invalidate,
  }
}
