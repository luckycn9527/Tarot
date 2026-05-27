import { storageGetRaw } from '@/utils/storage'

const ANGLE_BRACKETS = /[<>]/g
const JS_PROTOCOL = /javascript\s*:/gi
const EVENT_HANDLERS = /on\w+\s*=/gi

const MAX_INPUT_LENGTH = 500

export function sanitizeInput(raw: string): string {
  return raw
    .replace(ANGLE_BRACKETS, '')
    .replace(JS_PROTOCOL, '')
    .replace(EVENT_HANDLERS, '')
    .trim()
    .slice(0, MAX_INPUT_LENGTH)
}

/** @param logicalKey 命名空间存储键；legacyBareKey 为旧版裸 localStorage 键（可迁移） */
export function sanitizeStoredInput(logicalKey: string, legacyBareKey?: string): string {
  const raw = storageGetRaw(logicalKey, legacyBareKey)
  if (!raw) return ''
  return sanitizeInput(raw)
}
