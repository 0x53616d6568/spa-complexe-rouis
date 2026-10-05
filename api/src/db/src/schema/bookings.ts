import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { servicesTable } from "./services";
import { staffProfilesTable } from "./staff";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]);

export const bookingsTable = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingReference: text("booking_reference").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customersTable.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => servicesTable.id),
    staffId: uuid("staff_id").references(() => staffProfilesTable.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    status: bookingStatusEnum("status").notNull().default("pending"),
    customerNote: text("customer_note"),
    cancellationReason: text("cancellation_reason"),
    durationMinutes: integer("duration_minutes").notNull(),
    priceAmount: integer("price_amount").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("bookings_reference_uq").on(table.bookingReference),
    uniqueIndex("bookings_idempotency_key_uq").on(table.idempotencyKey),
    index("bookings_start_status_idx").on(table.startsAt, table.status),
    index("bookings_customer_idx").on(table.customerId, table.startsAt),
    index("bookings_staff_idx").on(table.staffId, table.startsAt),
  ],
);

export const bookingServiceItemsTable = pgTable(
  "booking_service_items",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => servicesTable.id),
    serviceName: text("service_name").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceAmount: integer("price_amount").notNull(),
    currency: text("currency").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bookingId, table.position] }),
    index("booking_service_items_service_idx").on(table.serviceId),
  ],
);

export const bookingStatusHistoryTable = pgTable(
  "booking_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    fromStatus: bookingStatusEnum("from_status"),
    toStatus: bookingStatusEnum("to_status").notNull(),
    changedBy: text("changed_by").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("booking_status_history_booking_idx").on(table.bookingId)],
);

export const bookingSlotClaimsTable = pgTable(
  "booking_slot_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    slotStartsAt: timestamp("slot_starts_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("booking_slot_claims_start_uq").on(table.slotStartsAt),
    index("booking_slot_claims_booking_idx").on(table.bookingId),
  ],
);

export const guestBookingTokensTable = pgTable(
  "guest_booking_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookingsTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("guest_booking_tokens_hash_uq").on(table.tokenHash),
    index("guest_booking_tokens_booking_idx").on(table.bookingId),
    index("guest_booking_tokens_expiry_idx").on(table.expiresAt),
  ],
);

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
