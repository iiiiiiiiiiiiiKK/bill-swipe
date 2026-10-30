import type { Db } from '../db';

/**
 * Fixed-window rate limiter persisted in the core database so limits survive
 * Worker isolates and are consistent across regions.
 */
export function rateLimit(
  db: Db,
  bucket: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  if (!bucket || !Number.isFinite(limit) || limit <= 0) return { allowed: true, retryAfter: 0 };
  const now = Date.now();
  const row = db.first<{ count: number; window_start: number }>(
    'SELECT count, window_start FROM rate_limits WHERE bucket = ?',
    bucket,
  );
  if (!row || now - row.window_start > windowMs) {
    db.run(
      `INSERT INTO rate_limits (bucket, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET count = 1, window_start = excluded.window_start`,
      bucket,
      now,
    );
    // Opportunistic cleanup of stale buckets keeps the table small.
    if (Math.random() < 0.02) {
      db.run('DELETE FROM rate_limits WHERE window_start < ?', now - 6 * 60 * 60 * 1000);
    }
    return { allowed: true, retryAfter: 0 };
  }
  if (row.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.window_start + windowMs - now) / 1000)) };
  }
  db.run('UPDATE rate_limits SET count = count + 1 WHERE bucket = ?', bucket);
  return { allowed: true, retryAfter: 0 };
}
