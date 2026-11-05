/** Prevent an old in-flight read from repopulating a cache after a config change. */
export function invalidatableCache<T>(load: () => Promise<T>, ttl: number) {
  let epoch = 0;
  let cached: { data: T; expiresAt: number } | null = null;
  let inflight: Promise<T> | null = null;
  return {
    invalidate() { epoch++; cached = null; inflight = null; },
    get(): Promise<T> {
      if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
      if (inflight) return inflight;
      const current = epoch;
      const request = load().then(data => {
        if (current === epoch) cached = { data, expiresAt: Date.now() + ttl };
        return data;
      }).finally(() => { if (inflight === request) inflight = null; });
      inflight = request;
      return request;
    },
  };
}
