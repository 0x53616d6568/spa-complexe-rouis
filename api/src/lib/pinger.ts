import { logger } from "./logger";

/**
 * Checks if the current time in the target timezone is within active operating hours (6 AM to Midnight)
 */
function isOperatingHours(): boolean {
  try {
    const timeZone = process.env.TIMEZONE || "Africa/Tunis";
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    });
    const currentHour = Number(formatter.format(new Date()));
    // Active from 6 AM (06:00) up to midnight (23:59)
    return currentHour >= 6 && currentHour < 24;
  } catch {
    // Fallback to system hour if timezone formatting fails
    const hour = new Date().getHours();
    return hour >= 6 && hour < 24;
  }
}

export function startKeepAlivePinger() {
  const targetUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_API_URL ||
    "https://spa-complexe-rouis.onrender.com";

  const isProduction =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.RENDER_EXTERNAL_URL);

  if (!isProduction && !process.env.ENABLE_KEEP_ALIVE) {
    logger.info("Keep-alive pinger skipped (development mode)");
    return;
  }

  const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  logger.info(
    { targetUrl, schedule: "Active daily from 06:00 to 00:00 (Tunis/UTC+1)" },
    "Keep-Alive Self-Pinger initialized",
  );

  setInterval(async () => {
    if (!isOperatingHours()) {
      logger.info("[Keep-Alive] Outside active hours (sleeping 00:00 - 06:00). Ping skipped.");
      return;
    }

    try {
      const pingEndpoint = `${targetUrl.replace(/\/+$/, "")}/api/healthz`;
      const response = await fetch(pingEndpoint);
      if (response.ok) {
        logger.info({ status: response.status }, "[Keep-Alive] Ping successful (200 OK)");
      } else {
        logger.warn({ status: response.status }, "[Keep-Alive] Received non-200 status");
      }
    } catch (err: any) {
      logger.error({ error: err.message }, "[Keep-Alive] Ping request failed");
    }
  }, PING_INTERVAL_MS);
}
