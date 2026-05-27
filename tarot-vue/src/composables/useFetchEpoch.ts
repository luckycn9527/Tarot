import { ref } from 'vue'

/**
 * 防止异步请求「后发先至」覆盖当前 UI：每个逻辑域用独立 key，
 * begin(key) 得到 token，await 后若 isStale(key, token) 则丢弃结果。
 * 切换 Tab 时对旧 Tab 调用 invalidate(tabKey) 即可作废该域在途请求。
 */
export function useFetchEpoch() {
  const epochs = ref<Record<string, number>>({})

  function invalidate(key: string) {
    epochs.value = { ...epochs.value, [key]: (epochs.value[key] ?? 0) + 1 }
  }

  function begin(key: string): number {
    const next = (epochs.value[key] ?? 0) + 1
    epochs.value = { ...epochs.value, [key]: next }
    return next
  }

  function isStale(key: string, token: number): boolean {
    return (epochs.value[key] ?? 0) !== token
  }

  return { invalidate, begin, isStale }
}
