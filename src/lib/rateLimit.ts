// In-memory sliding window rate limiter for server routes

interface RateLimitRecord {
  timestamps: number[];
}

const ipMap = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipMap.entries()) {
    const freshTimestamps = record.timestamps.filter((t) => now - t < 60000);
    if (freshTimestamps.length === 0) {
      ipMap.delete(ip);
    } else {
      record.timestamps = freshTimestamps;
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  ip: string,
  limit: number = 10,
  windowMs: number = 60000
): { success: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const record = ipMap.get(ip) || { timestamps: [] };

  // Retain timestamps within the window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldestTimestamp));
    return {
      success: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  ipMap.set(ip, record);

  return {
    success: true,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}
