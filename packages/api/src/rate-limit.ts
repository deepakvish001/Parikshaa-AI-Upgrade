/**
 * Token-bucket rate limits (ROADMAP §10).
 *
 * One bucket per key — an organisation for staff and API-key traffic, an
 * attempt for a candidate's — refilled at `perSecond` up to `burst`. One
 * organisation's integration looping on the API cannot starve another's sitting,
 * and one candidate's runaway tab cannot starve the rest of the room.
 *
 * Held in memory, so each API instance limits on its own: behind N instances an
 * organisation gets up to N times the rate. That is the right failure mode for
 * a limit whose job is fairness under load, not billing.
 */
export interface RateLimit {
  readonly perSecond: number;
  readonly burst: number;
}

export class RateLimiter {
  readonly #limit: RateLimit;
  readonly #now: () => number;
  readonly #buckets = new Map<string, { tokens: number; at: number }>();

  constructor(limit: RateLimit, now: () => number = () => Date.now()) {
    this.#limit = limit;
    this.#now = now;
  }

  /** Spend one token for `key`. When there is none, how many seconds until there will be. */
  take(key: string): { readonly ok: true } | { readonly ok: false; readonly retryAfterSeconds: number } {
    const now = this.#now();
    const { perSecond, burst } = this.#limit;
    const bucket = this.#buckets.get(key) ?? { tokens: burst, at: now };
    bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.at) / 1000) * perSecond);
    bucket.at = now;
    if (bucket.tokens < 1) {
      this.#buckets.set(key, bucket);
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((1 - bucket.tokens) / perSecond)) };
    }
    bucket.tokens -= 1;
    this.#buckets.set(key, bucket);
    if (this.#buckets.size > 50_000) this.#sweep(now);
    return { ok: true };
  }

  /** Forget buckets that have refilled: they hold nothing a fresh one would not. */
  #sweep(now: number): void {
    const { perSecond, burst } = this.#limit;
    for (const [key, bucket] of this.#buckets) {
      if (bucket.tokens + ((now - bucket.at) / 1000) * perSecond >= burst) this.#buckets.delete(key);
    }
  }
}

/** Generous for people, tight enough to stop a loop. Candidates autosave about once a second while typing. */
export const DEFAULT_LIMITS = {
  organisation: { perSecond: 100, burst: 400 },
  attempt: { perSecond: 10, burst: 60 },
} as const satisfies Record<string, RateLimit>;
