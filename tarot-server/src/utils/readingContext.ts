import { createHash } from 'node:crypto';

export function recentSavedFollowups(data: unknown): { question: string; answer: string }[] {
  if (!data || typeof data !== 'object') return [];
  const turns = (data as { followups?: unknown }).followups;
  if (!Array.isArray(turns)) return [];
  return turns.filter((turn): turn is { question: string; answer: string } =>
    !!turn && typeof turn.question === 'string' && typeof turn.answer === 'string'
    && !!turn.question.trim() && !!turn.answer.trim(),
  ).slice(-6).map(turn => ({ question: turn.question.slice(0, 200), answer: turn.answer.slice(0, 2000) }));
}

/** A full 200-record window can change while its size stays exactly the same. */
export function historyInsightKey(months: number, locale: string, day: string,
  rows: { id: number; question: string }[]): string {
  return createHash('sha256').update(JSON.stringify([months, locale, day,
    rows.map(row => [row.id, row.question]),
  ])).digest('hex');
}
