/** 与 tarot-server `VALIDATION_ERROR_CODE` 对齐 */
const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR'

type AdminErrorBody = {
  success?: boolean
  message?: string
  code?: string
  details?: {
    fieldErrors?: Record<string, (string | undefined)[] | undefined>
    formErrors?: string[]
  }
}

type AxiosLike = {
  response?: {
    data?: AdminErrorBody
  }
}

function firstDetailMessage(details: AdminErrorBody['details']): string | undefined {
  if (!details || typeof details !== 'object') return undefined
  const { fieldErrors, formErrors } = details
  if (fieldErrors && typeof fieldErrors === 'object') {
    for (const arr of Object.values(fieldErrors)) {
      if (!Array.isArray(arr)) continue
      const first = arr.find((x): x is string => typeof x === 'string' && x.trim().length > 0)
      if (first) return first.trim()
    }
  }
  const fe = formErrors?.find((x) => typeof x === 'string' && x.trim().length > 0)
  return fe?.trim()
}

/**
 * 管理端 axios 错误 → 展示用文案（读取 `message`，并兼容仅有 `code`+`details` 的校验响应）。
 */
export function formatAdminApiError(e: unknown, fallback: string): string {
  const data = (e as AxiosLike)?.response?.data
  const msg = typeof data?.message === 'string' ? data.message.trim() : ''
  if (msg) return msg

  if (data?.code === VALIDATION_ERROR_CODE) {
    const fromDetails = firstDetailMessage(data.details)
    if (fromDetails) return fromDetails
  }

  if (e instanceof Error && e.message) return e.message
  return fallback
}
