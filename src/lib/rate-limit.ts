import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type TokenBucket = {
  timestamps: number[];
};

const buckets = new Map<string, TokenBucket>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimitWithKey(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  logContext?: { ip: string; path: string },
): NextResponse | null {
  const now = Date.now();
  const windowStart = now - windowMs;

  cleanup(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= limit) {
    console.warn(
      JSON.stringify({
        event: "security:rate_limit_exceeded",
        key,
        ...(logContext ?? {}),
        count: bucket.timestamps.length,
        limit,
        ts: new Date(now).toISOString(),
      }),
    );
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) },
      },
    );
  }

  bucket.timestamps.push(now);
  return null;
}

/** Per-key limiter (e.g. user-id or compound key). */
export function rateLimitByKey(
  key: string,
  opts: RateLimitOptions,
): NextResponse | null {
  return rateLimitWithKey(key, opts);
}

/** Per-IP + path limiter. */
export function rateLimit(
  request: NextRequest,
  opts: RateLimitOptions,
): NextResponse | null {
  const ip = getClientIp(request);
  const key = `${ip}:${request.nextUrl.pathname}`;
  return rateLimitWithKey(key, opts, {
    ip,
    path: request.nextUrl.pathname,
  });
}
