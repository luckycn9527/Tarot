import * as Requests from '../models/mobileRequest.model.js';
import * as ReadingModel from '../models/reading.model.js';
import * as ReadingService from './reading.service.js';
import { acquireAiTaskLease } from '../middleware/aiGuard.js';
import { ApiError } from '../utils/apiError.js';
import { mobilePayloadHash, type MobileRequestKind } from '../utils/mobileRequest.js';
import { quotaWindow } from '../utils/quotaDate.js';
import { env } from '../config/env.js';
import type { MobileReadingInput, MobileFollowupInput } from '../schemas/mobile.schema.js';

type ReadingResult = Awaited<ReturnType<typeof ReadingService.readerReading>>;
type FollowupResult = Awaited<ReturnType<typeof ReadingService.readerFollowup>>;
const activeRunners = new Set<Promise<void>>();
/** Allows isolated integration fixtures to drain work before restoring their SQL adapter. */
export async function waitForIdle() { await Promise.allSettled([...activeRunners]); }
export interface MobileTask {
  requestId: string; kind: MobileRequestKind; status: 'running' | 'succeeded' | 'failed';
  result?: ReadingResult | FollowupResult; historyId?: number;
  error?: { code: string; message: string }; retryable?: boolean;
}
function parsedData(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function publicTask(task: Requests.MobileRequestRow): Promise<MobileTask> {
  const base: MobileTask = { requestId: task.request_id, kind: task.kind, status: task.status };
  if (task.status === 'running') return base;
  if (task.status === 'failed') return { ...base, error: { code: task.error_code || 'generation_failed',
    message: task.error_message || '本次解读未完成，请重试' }, retryable: ['generation_failed', 'request_interrupted'].includes(task.error_code || '') };
  const history = task.history_id ? await ReadingModel.findById(task.history_id, task.user_id) : null;
  if (!history) {
    await Requests.markHistoryRemoved(task.user_id, task.request_id);
    return { ...base, status: 'failed', error: { code: 'history_removed', message: '原占卜记录已删除' }, retryable: false };
  }
  const data = parsedData(history.resultData);
  if (task.kind === 'reading') {
    const metadata = task.result_metadata as Omit<ReadingResult, 'id' | 'result'> | null;
    if (!metadata) throw new ApiError(500, '请求结果暂时无法读取，请稍后刷新');
    return { ...base, historyId: history.id, result: { ...metadata, id: history.id,
      result: { messages: Array.isArray(data.messages) ? data.messages as ReadingResult['result']['messages'] : [],
        summary: typeof data.summary === 'string' ? data.summary : '' } } };
  }
  const turns = Array.isArray(data.followups) ? data.followups : [];
  const turn = turns.map(parsedData).find(entry => entry.requestId === task.request_id);
  if (!turn || typeof turn.question !== 'string' || typeof turn.answer !== 'string') throw new ApiError(500, '追问结果暂时无法读取，请稍后刷新');
  return { ...base, historyId: history.id, result: { readingId: history.id, question: turn.question, answer: turn.answer } };
}

async function run(task: Requests.MobileRequestRow, input: MobileReadingInput | MobileFollowupInput, release: () => Promise<void>) {
  try {
    if (task.kind === 'reading') {
      const payload = input as MobileReadingInput;
      await ReadingService.readerReading(task.user_id, payload.readerId, payload.spreadType, payload.question, payload.category,
        payload.cardIds, payload.orientations, payload.locale, async (data, metadata) => Requests.complete(task, async connection => ({
          historyId: await ReadingModel.create(data, connection), metadata,
        })));
    } else {
      const payload = input as MobileFollowupInput;
      await ReadingService.readerFollowup(task.user_id, payload.readingId, payload.question, undefined, payload.locale,
        async (readingId, userId, turn) => {
          await Requests.complete(task, async connection => {
            const saved = await ReadingModel.appendFollowupTurn(readingId, userId, { ...turn, requestId: task.request_id }, connection);
            if (!saved) throw new ApiError(404, '占卜记录不存在或无权访问');
            return { historyId: readingId, metadata: null };
          });
          return true;
        });
    }
  } catch (error) {
    const safe = error instanceof Error && ['塔罗师不存在', '该塔罗师仅限VIP会员使用', '该牌阵仅限VIP会员使用',
      '占卜记录不存在或无权访问', '该记录不支持追问'].includes(error.message) ? error.message : '本次解读未完成，本次额度已释放，请重试';
    try { await Requests.fail(task, 'generation_failed', safe); }
    catch { console.error(JSON.stringify({ event: 'mobile_request_failure_persist_failed', requestId: task.request_id })); }
  } finally { await release(); }
}

export async function submit(userId: number, kind: MobileRequestKind, input: MobileReadingInput | MobileFollowupInput) {
  await Requests.recoverExpired(userId);
  const hash = mobilePayloadHash(kind, input);
  const existing = await Requests.find(userId, input.requestId);
  if (existing) {
    if (existing.kind !== kind || existing.payload_hash !== hash) throw new ApiError(409, '请求编号已对应其他内容，请勿修改原请求的牌面或问题');
    return publicTask(existing);
  }
  const release = await acquireAiTaskLease(userId);
  if (!release) throw new ApiError(429, '上一条 AI 解读仍在生成或请求过于频繁，请稍后再试');
  try {
    const claimed = await Requests.claim(userId, input.requestId, kind, hash, quotaWindow(env.QUOTA_TIME_ZONE).businessDate);
    if (!claimed.fresh) {
      await release();
      if (claimed.task.kind !== kind || claimed.task.payload_hash !== hash) throw new ApiError(409, '请求编号已对应其他内容');
      return publicTask(claimed.task);
    }
    // This promise intentionally outlives the request/response socket. Durable completion
    // and refunds are owned by the task runner, never by HTTP close/finish listeners.
    const job = run(claimed.task, input, release).finally(() => { activeRunners.delete(job); });
    activeRunners.add(job);
    void job.catch(() => {
      console.error(JSON.stringify({ event: 'mobile_request_runner_failed', requestId: input.requestId }));
    });
    return publicTask(claimed.task);
  } catch (error) { await release(); throw error; }
}

export async function status(userId: number, requestId: string) {
  await Requests.recoverExpired(userId);
  const task = await Requests.find(userId, requestId);
  if (!task) throw new ApiError(404, '请求不存在或无权访问');
  return publicTask(task);
}

export async function historyDetail(userId: number, id: number) {
  const history = await ReadingModel.findById(id, userId);
  if (!history) throw new ApiError(404, '占卜记录不存在或无权访问');
  return history;
}
