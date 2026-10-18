import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "../clients/redis";
import { env } from "../env";

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

interface Limiter {
  limit: (identifier: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
}

const WINDOW_MS: Record<"s" | "m" | "h" | "d", number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function windowToMs(window: Window): number {
  const [n, unit] = window.split(" ") as [string, "s" | "m" | "h" | "d"];
  return Number(n) * WINDOW_MS[unit];
}

/**
 * In-memory sliding-window limiter. Used when Upstash isn't configured.
 *
 * Probe runs as a single container on one VPS, so a distributed store
 * (Upstash) is unnecessary — process memory shares state across every request
 * this instance handles. Counters reset on restart and aren't shared across
 * instances; both are irrelevant for a single-instance deploy. Scale out and
 * set UPSTASH_REDIS_REST_URL/_TOKEN, and this is swapped for the distributed
 * limiter automatically (see makeLimiter).
 */
function makeMemoryLimiter(rate: number, window: Window): Limiter {
  const windowMs = windowToMs(window);
  // identifier -> ascending list of request timestamps within the window.
  const hits = new Map<string, number[]>();

  // Periodically drop keys whose timestamps have all expired so the Map can't
  // grow unbounded with one entry per IP forever. unref() so it never keeps the
  // process alive on its own.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, times] of hits) {
      const live = times.filter((t) => t > cutoff);
      if (live.length === 0) hits.delete(key);
      else hits.set(key, live);
    }
  }, windowMs);
  sweep.unref?.();

  return {
    limit: async (identifier: string) => {
      const now = Date.now();
      const cutoff = now - windowMs;
      const recent = (hits.get(identifier) ?? []).filter((t) => t > cutoff);
      const success = recent.length < rate;
      if (success) recent.push(now);
      hits.set(identifier, recent);
      return {
        success,
        limit: rate,
        remaining: Math.max(0, rate - recent.length),
        reset: (recent[0] ?? now) + windowMs,
      };
    },
  };
}

/**
 * Distributed (Upstash) when configured, in-memory otherwise. Either way rate
 * limiting is ALWAYS on — a missing Upstash no longer means "no protection", it
 * just means "single-instance, in-process counters".
 */
function makeLimiter(rate: number, window: Window): Limiter {
  if (!redis) {
    if (env.NODE_ENV === "production") {
      console.info(
        "ℹ️ Upstash not configured — using in-memory rate limiting (fine for a single instance; set UPSTASH_REDIS_REST_URL/_TOKEN to share limits across instances).",
      );
    }
    return makeMemoryLimiter(rate, window);
  }
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rate, window),
    analytics: false,
    prefix: "probe",
  });
}

// 5 submissions per form per IP per hour.
export const submitLimiter = makeLimiter(5, "1 h");

// 60 events per IP per minute — track endpoints are chatty but bounded.
export const eventLimiter = makeLimiter(60, "1 m");

// 10 login attempts per IP per 5 minutes.
export const authLimiter = makeLimiter(10, "5 m");
