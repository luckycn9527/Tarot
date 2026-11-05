import { createHash } from 'node:crypto';

export type MobileRequestKind = 'reading' | 'followup';
export const MOBILE_REQUEST_LEASE_MS = 180_000;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
/** UUID identifies a submission; the hash forbids changing its original cards/question. */
export function mobilePayloadHash(kind: MobileRequestKind, input: Record<string, unknown>) {
  const { requestId: _requestId, ...payload } = input;
  return createHash('sha256').update(JSON.stringify(canonical({ kind, payload }))).digest('hex');
}
