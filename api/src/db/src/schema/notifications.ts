import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { bookingsTable } from "./bookings";
import { customersTable } from "./customers";

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sending",
  "sent",
  "failed",
]);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customersTable.id),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("email"),
    templateKey: text("template_key").notNull(),
    recipient: text("recipient").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: notificationStatusEnum("status").notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_status_created_idx").on(table.status, table.createdAt),
    index("notifications_booking_idx").on(table.bookingId),
  ],
);

export const insertNotificationSchema = createInsertSchema(
  notificationsTable,
).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;