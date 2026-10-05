const wallClockFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

function partsFor(date: Date, timeZone: string): Record<string, string> {
  return Object.fromEntries(
    wallClockFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function localDateFor(instant: Date, timeZone: string): string {
  const parts = partsFor(instant, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;

  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  let estimate = new Date(targetUtc);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = partsFor(estimate, timeZone);
    const observedLocalAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const adjustment = targetUtc - observedLocalAsUtc;
    estimate = new Date(estimate.getTime() + adjustment);
    if (adjustment === 0) break;
  }

  const resolved = partsFor(estimate, timeZone);
  if (
    resolved.year !== String(year).padStart(4, "0") ||
    resolved.month !== String(month).padStart(2, "0") ||
    resolved.day !== String(day).padStart(2, "0") ||
    resolved.hour !== String(hour).padStart(2, "0") ||
    resolved.minute !== String(minute).padStart(2, "0")
  ) {
    return null;
  }

  return estimate;
}

export function localDateTimeLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}

export function localWeekday(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

export function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMinutesAsTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function slotClaimInstants(start: Date, end: Date): Date[] {
  const bucketMilliseconds = 30 * 60 * 1000;
  const firstBucket =
    Math.floor(start.getTime() / bucketMilliseconds) * bucketMilliseconds;
  const claims: Date[] = [];

  for (let current = firstBucket; current < end.getTime(); current += bucketMilliseconds) {
    claims.push(new Date(current));
  }

  return claims;
}