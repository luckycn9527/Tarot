import type { MobileTask, PendingMobileTask } from './types'
import { taskReadingId } from './mobileNavigation'

export interface MobileTaskRecoveryState {
  owner: number | null
  readingId: number | null
  readingMissing: boolean
  task: PendingMobileTask | null
  needsResend: boolean
  posting: boolean
  polling: boolean
}
export function canAbandonUnconfirmedFollowup(state: MobileTaskRecoveryState): boolean {
  const task = state.task
  return state.owner !== null && !!task && task.owner === state.owner && task.kind === 'followup' &&
    state.readingId !== null && taskReadingId(task) === state.readingId && state.readingMissing &&
    state.needsResend && !state.posting && !state.polling
}
interface MobileTaskRecoveryOptions {
  state: () => MobileTaskRecoveryState
  sameSession: () => boolean
  confirm: (task: PendingMobileTask) => boolean | Promise<boolean>
  inspect: (requestId: string) => Promise<MobileTask>
  isMissing: (error: unknown) => boolean
  accepted: (status: MobileTask, task: PendingMobileTask) => Promise<void>
  preserve: (task: PendingMobileTask) => Promise<void>
  remove: (task: PendingMobileTask) => Promise<boolean>
  completed: (task: PendingMobileTask) => void
}
export type MobileTaskRecoveryResult = 'unavailable' | 'cancelled' | 'changed' | 'accepted' | 'abandoned'

/** End local tracking only after a second server lookup still cannot confirm acceptance. */
export async function abandonUnconfirmedFollowup(options: MobileTaskRecoveryOptions): Promise<MobileTaskRecoveryResult> {
  const initial = options.state(), task = initial.task
  if (!task || !options.sameSession() || !canAbandonUnconfirmedFollowup(initial)) return 'unavailable'
  const unchanged = () => options.sameSession() && options.state().task?.requestId === task.requestId &&
    canAbandonUnconfirmedFollowup(options.state())
  if (!await options.confirm(task)) return 'cancelled'
  if (!unchanged()) return 'changed'
  let status: MobileTask | undefined, missing = false
  try { status = await options.inspect(task.requestId) }
  catch (error) { if (!options.isMissing(error)) throw error; missing = true }
  if (!unchanged()) return 'changed'
  if (!missing) {
    if (!status || status.requestId !== task.requestId || status.kind !== task.kind || !['running', 'succeeded', 'failed'].includes(status.status)) throw new Error('The original request could not be confirmed')
    await options.accepted(status, task)
    return 'accepted'
  }
  // Preserve the original text before removing its only durable pending entry.
  await options.preserve(task)
  if (!unchanged()) return 'changed'
  if (!await options.remove(task) || !options.sameSession()) return 'changed'
  options.completed(task)
  return 'abandoned'
}
