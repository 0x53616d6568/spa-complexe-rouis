import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const spaSettingsTable = pgTable("spa_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone").notNull(),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  currency: text("currency").notNull().default("NGN"),
  cancellationPolicy: text("cancellation_policy").notNull(),
  bookingWindowDays: integer("booking_window_days").notNull().default(60),
  minimumNoticeHours: integer("minimum_notice_hours").notNull().default(2),
  isDemo: boolean("is_demo").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSpaSettingsSchema = createInsertSchema(spaSettingsTable).omit({
  updatedAt: true,
});
export type InsertSpaSettings = z.infer<typeof insertSpaSettingsSchema>;
export type SpaSettings = typeof spaSettingsTable.$inferSelect;