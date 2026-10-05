import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

function managementSecret(): string {
  const secret = process.env.GUEST_BOOKING_MANAGEMENT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("GUEST_BOOKING_MANAGEMENT_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

export function createGuestBookingManagementToken(notificationId: string, bookingId: string): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = createHmac("sha256", managementSecret())
    .update(`${notificationId}:${bookingId}`)
    .digest("base64url");
  return { token, tokenHash: hashGuestBookingManagementToken(token), expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS) };
}

export function recoverGuestBookingManagementToken(notificationId: string, bookingId: string): string {
  return createHmac("sha256", managementSecret())
    .update(`${notificationId}:${bookingId}`)
    .digest("base64url");
}

export function hashGuestBookingManagementToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createGuestBookingManagementUrl(token: string): string | null {
  const origin = process.env.PUBLIC_APP_URL?.trim();
  if (!origin) return null;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("PUBLIC_APP_URL must be a valid absolute URL.");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("PUBLIC_APP_URL must use HTTPS, except for localhost development.");
  }
  parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/booking/manage`;
  parsed.search = new URLSearchParams({ token }).toString();
  parsed.hash = "";
  return parsed.toString();
}

export function isValidGuestBookingManagementToken(provided: string, expectedHash: string): boolean {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(provided)) return false;
  const actual = Buffer.from(hashGuestBookingManagementToken(provided), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
