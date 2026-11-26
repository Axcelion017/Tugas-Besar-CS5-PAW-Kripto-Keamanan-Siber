// lib/auth/rateLimit.ts
// Sliding-window rate limiter & konstanta anti-Account Enumeration (OWASP ASVS V2.2.1 & V2.2.2 / CWE-204)

export const UNIFORM_LOGIN_ERROR = "Kredensial atau kata sandi tidak valid.";

// Hash Bcrypt valid (cost 10) untuk pembandingan dummy saat user tidak ditemukan
// agar waktu respons konstan dan mencegah timing-based account enumeration.
export const DUMMY_BCRYPT_HASH =
  "$2b$10$CwTycUXWue0Thq9StjUM0uJ8lR6sW1uJ4wF5qN6Y6j4R6b6W8k2iK";

export interface RateLimitOptions {
  maxAttempts?: number;
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MS = 60_000; // 1 menit

const globalForRateLimit = globalThis as unknown as {
  __jagamedisRateLimitStore?: Map<string, number[]>;
};

function getStore(): Map<string, number[]> {
  if (!globalForRateLimit.__jagamedisRateLimitStore) {
    globalForRateLimit.__jagamedisRateLimitStore = new Map<string, number[]>();
  }
  return globalForRateLimit.__jagamedisRateLimitStore;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();
  const cutoff = now - windowMs;
  const store = getStore();

  const existing = (store.get(key) || []).filter((ts) => ts > cutoff);

  if (existing.length >= maxAttempts) {
    const oldest = existing[0] ?? now;
    const retryAfterMs = Math.max(1000, windowMs - (now - oldest));
    store.set(key, existing);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  existing.push(now);
  store.set(key, existing);

  // Bersihkan entri usang secara berkala agar memori tidak membengkak
  if (store.size > 500) {
    for (const [k, timestamps] of store.entries()) {
      const fresh = timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) store.delete(k);
      else store.set(k, fresh);
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - existing.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(key: string): void {
  getStore().delete(key);
}

export function clearAllRateLimits(): void {
  getStore().clear();
}
