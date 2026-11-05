const SHARED_TEXT_FIELDS = ['interpretation', 'advice', 'conclusion', 'summary'] as const;

export function sanitizeSharedResultData(raw: unknown): Record<string, unknown> | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of SHARED_TEXT_FIELDS) {
    if (typeof source[key] === 'string') safe[key] = source[key];
  }
  if (Array.isArray(source.messages)) {
    safe.messages = source.messages
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const message = item as Record<string, unknown>;
        return {
          type: typeof message.type === 'string' ? message.type : 'reading',
          content: typeof message.content === 'string' ? message.content : '',
        };
      })
      .filter((message) => message.content);
  }
  return safe;
}
