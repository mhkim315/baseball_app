import * as db from "./db";

// ── Concurrency limiter ──

const MAX_CONCURRENT = 3;
let inFlight = 0;
const requestQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    requestQueue.push(() => { inFlight++; resolve(); });
  });
}

function releaseSlot() {
  inFlight--;
  const next = requestQueue.shift();
  if (next) next();
}

export async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

// ── Background retry (exponential backoff + jitter) ──

const RETRY_DELAYS = [5_000, 15_000, 45_000];
const retryCounts = new Map<string, number>();

export function scheduleRetry<T>(key: string, fetcher: () => Promise<T | null>, cachedAt?: number) {
  const done = retryCounts.get(key) ?? 0;
  if (done >= RETRY_DELAYS.length) {
    retryCounts.delete(key);
    return;
  }
  retryCounts.set(key, done + 1);
  const baseDelay = RETRY_DELAYS[done];
  const jitter = baseDelay * (0.7 + Math.random() * 0.6);
  setTimeout(async () => {
    try {
      if (cachedAt) {
        const current = db.getCache(key);
        if (current && current.updatedAt > cachedAt) {
          retryCounts.delete(key);
          return;
        }
      }
      const fresh = await withConcurrencyLimit(() => fetcher());
      if (fresh) {
        db.setCache(key, JSON.stringify(fresh));
        retryCounts.delete(key);
      } else {
        scheduleRetry(key, fetcher, cachedAt);
      }
    } catch {
      scheduleRetry(key, fetcher, cachedAt);
    }
  }, Math.round(jitter));
}

// ── Utilities ──

export function safeParse(json: string): unknown | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function ttlForDate(dateStr: string): number {
  const today = todayStr();
  if (dateStr < today) return Infinity;
  if (dateStr === today) return 120_000;
  return 3600_000;
}

export function cacheKey(name: string, id: string): string {
  return `${name}:${id}`;
}

// ── Core cache-with-stale-fallback ──

const pendingFetches = new Map<string, Promise<unknown | null>>();

export async function fetchWithCache<T>(
  cacheKeyStr: string,
  ttl: number,
  fetcher: () => Promise<T | null>
): Promise<T | null> {
  const cached = db.getCache(cacheKeyStr);
  if (cached) {
    const parsed = safeParse(cached.data);
    if (parsed && Date.now() - cached.updatedAt < ttl) {
      return parsed as T;
    }
    if (!parsed) {
      db.deleteCache(cacheKeyStr);
    }
  }

  const pending = pendingFetches.get(cacheKeyStr);
  if (pending) return pending.then((r) => r as T | null);

  const promise = (async (): Promise<T | null> => {
    const fresh = await withConcurrencyLimit(() => fetcher());
    if (fresh) {
      db.setCache(cacheKeyStr, JSON.stringify(fresh));
      return fresh;
    }
    if (cached) {
      const parsed = safeParse(cached.data);
      if (parsed) {
        scheduleRetry(cacheKeyStr, fetcher, cached.updatedAt);
        return parsed as T;
      }
    }
    scheduleRetry(cacheKeyStr, fetcher);
    return null;
  })();

  pendingFetches.set(cacheKeyStr, promise);
  try {
    return await promise;
  } finally {
    setTimeout(() => pendingFetches.delete(cacheKeyStr), 2000);
  }
}
