import type { RequestHandler } from "express";

type WindowEntry = { count: number; resetAt: number };

/**
 * Small per-process fixed-window limiter for public endpoints. For multiple API
 * instances, replace the in-memory map with a shared store before scaling out.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  message: string;
}): RequestHandler {
  const windows = new Map<string, WindowEntry>();

  return (request, response, next) => {
    const now = Date.now();
    const address = request.ip || request.socket.remoteAddress || "unknown";
    let entry = windows.get(address);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      windows.set(address, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, options.limit - entry.count);
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    response.setHeader("RateLimit-Limit", options.limit);
    response.setHeader("RateLimit-Remaining", remaining);
    response.setHeader("RateLimit-Reset", resetSeconds);

    if (entry.count > options.limit) {
      response.setHeader("Retry-After", resetSeconds);
      response.status(429).json({ error: options.message });
      return;
    }

    if (windows.size > 20_000) {
      for (const [key, value] of windows) {
        if (value.resetAt <= now || windows.size > 15_000) windows.delete(key);
        if (windows.size <= 15_000) break;
      }
    }
    next();
  };
}
