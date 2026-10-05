import nodemailer, { type Transporter } from "nodemailer";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import {
  db,
  notificationsTable,
  notificationStatusEnum,
} from "@workspace/db";
import { logger } from "../../lib/logger";
import { createGuestBookingManagementUrl, recoverGuestBookingManagementToken } from "../guest-bookings/management-token";

type NotificationRow = typeof notificationsTable.$inferSelect;
type EmailConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

let timer: NodeJS.Timeout | undefined;
let transporter: Transporter | undefined;
let processing = false;

function getEmailConfiguration(): EmailConfiguration | null {
  if ((process.env.EMAIL_PROVIDER ?? "smtp").toLowerCase() === "disabled") {
    return null;
  }

  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!user || !password || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535.");
  }

  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
    user,
    password,
    from,
  };
}

function payloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrice(amount: unknown, currency: unknown): string {
  if (typeof amount !== "number" || typeof currency !== "string") return "";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

function emailContent(notification: NotificationRow) {
  const payload = notification.payload;
  const spaName = payloadString(payload, "spaName") || "Your spa";
  const name = payloadString(payload, "customerName") || "there";
  const reference = payloadString(payload, "bookingReference");
  const service = payloadString(payload, "serviceName");
  const timezone = payloadString(payload, "timezone") || "Africa/Lagos";
  const startsAt = payloadString(payload, "startsAt");
  const cancellationReason = payloadString(payload, "cancellationReason");
  const dateLabel = startsAt
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: timezone,
      }).format(new Date(startsAt))
    : "";
  const price = formatPrice(payload.priceAmount, payload.currency);
  let managementUrl: string | null = null;
  if (notification.templateKey === "booking_created" && process.env.GUEST_BOOKING_MANAGEMENT_SECRET && process.env.PUBLIC_APP_URL) {
    const managementToken = recoverGuestBookingManagementToken(notification.id, notification.bookingId);
    managementUrl = createGuestBookingManagementUrl(managementToken);
  }

  const templates: Record<
    string,
    { subject: string; introduction: string }
  > = {
    booking_created: {
      subject: `Booking request received · ${reference}`,
      introduction:
        "We received your appointment request. It is pending until the spa confirms it.",
    },
    booking_confirmed: {
      subject: `Your appointment is confirmed · ${reference}`,
      introduction: "Your appointment has been confirmed.",
    },
    booking_cancelled: {
      subject: `Your appointment was cancelled · ${reference}`,
      introduction: `Your appointment has been cancelled.${cancellationReason ? ` Reason: ${cancellationReason}` : ""}`,
    },
  };
  const template = templates[notification.templateKey] ?? {
    subject: `An update from ${spaName} · ${reference}`,
    introduction: "There is an update to your appointment.",
  };
  const details = [
    service ? `Service: ${service}` : "",
    dateLabel ? `Date and time: ${dateLabel}` : "",
    price ? `Price: ${price}` : "",
    reference ? `Reference: ${reference}` : "",
  ].filter(Boolean);
  const text = [
    `Hello ${name},`,
    "",
    template.introduction,
    "",
    ...details,
    ...(managementUrl ? ["", `View or cancel this appointment: ${managementUrl}`] : []),
    "",
    spaName,
  ].join("\n");
  const html = `
    <div style="background:#faf8f1;color:#273d36;font-family:Arial,sans-serif;padding:32px">
      <div style="max-width:560px;margin:0 auto;background:#fffdf8;border:1px solid #e4ded0;border-radius:20px;padding:32px">
        <p style="color:#687a70;font-size:12px;letter-spacing:2px;text-transform:uppercase">${htmlEscape(spaName)}</p>
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px">${htmlEscape(template.subject)}</h1>
        <p>Hello ${htmlEscape(name)},</p>
        <p>${htmlEscape(template.introduction)}</p>
        <div style="background:#f6f3e9;border-radius:12px;padding:18px;margin:24px 0">
          ${details.map((detail) => `<p style="margin:6px 0">${htmlEscape(detail)}</p>`).join("")}
        </div>
        ${managementUrl ? `<p><a href="${htmlEscape(managementUrl)}" style="display:inline-block;border-radius:999px;background:#294f45;color:#fff;padding:13px 20px;text-decoration:none">View or cancel this appointment</a></p>` : ""}
        <p style="color:#687a70;font-size:13px">If you have questions, contact the spa directly.</p>
      </div>
    </div>
  `;

  return { subject: template.subject, text, html };
}

async function claimBatch(): Promise<NotificationRow[]> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.status, "queued"),
          lte(notificationsTable.nextAttemptAt, new Date()),
        ),
      )
      .orderBy(asc(notificationsTable.createdAt))
      .limit(10)
      .for("update", { skipLocked: true });

    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const claimed = await tx
      .update(notificationsTable)
      .set({
        status: "sending",
        attemptCount: sql`${notificationsTable.attemptCount} + 1`,
      })
      .where(inArray(notificationsTable.id, ids))
      .returning();
    return claimed;
  });
}

async function deliver(notification: NotificationRow, from: string) {
  if (!transporter) throw new Error("SMTP transport is unavailable.");
  const content = emailContent(notification);
  await transporter.sendMail({
    from,
    to: notification.recipient,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

async function processQueue(from: string) {
  if (processing) return;
  processing = true;
  try {
    const batch = await claimBatch();
    for (const notification of batch) {
      try {
        await deliver(notification, from);
        await db
          .update(notificationsTable)
          .set({
            status: "sent",
            sentAt: new Date(),
            lastError: null,
          })
          .where(eq(notificationsTable.id, notification.id));
      } catch (error) {
        const exhausted = notification.attemptCount >= 5;
        const retryMinutes = Math.min(60, 2 ** notification.attemptCount);
        await db
          .update(notificationsTable)
          .set({
            status: exhausted ? "failed" : "queued",
            nextAttemptAt: new Date(Date.now() + retryMinutes * 60_000),
            lastError:
              error instanceof Error
                ? error.message.slice(0, 1000)
                : "Unknown email delivery error",
          })
          .where(eq(notificationsTable.id, notification.id));
        logger.error(
          { notificationId: notification.id, attempt: notification.attemptCount, error },
          "Booking email delivery failed",
        );
      }
    }
  } finally {
    processing = false;
  }
}

export function startNotificationWorker(): void {
  if (timer) return;

  let configuration: EmailConfiguration | null;
  try {
    configuration = getEmailConfiguration();
  } catch (error) {
    logger.error({ error }, "Invalid SMTP configuration; booking email delivery is paused");
    return;
  }

  if (!configuration) {
    logger.warn(
      "SMTP is not configured; booking requests will still be saved and email notifications remain queued",
    );
    return;
  }

  transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    auth: {
      user: configuration.user,
      pass: configuration.password,
    },
  });
  const from = configuration.from;
  timer = setInterval(() => {
    void processQueue(from).catch((error: unknown) => {
      logger.error({ error }, "Booking email queue processing failed");
    });
  }, 15_000);
  timer.unref();
  void processQueue(from).catch((error: unknown) => {
    logger.error({ error }, "Booking email queue processing failed");
  });
  logger.info({ host: configuration.host, port: configuration.port }, "SMTP notification worker started");
}
