// external call-এ timeout + retry-with-backoff (শুধু idempotent read/write)
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const { timeoutMs = 8000, retries = 3 } = opts;
  let last: unknown;
  for (let i = 0; i < retries; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      return await fn(ac.signal);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    } finally {
      clearTimeout(t);
    }
  }
  throw last instanceof Error ? last : new Error("request failed");
}
