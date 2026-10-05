import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { servicesTable } from "./services";

export const staffProfilesTable = pgTable(
  "staff_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id"),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    isBookable: boolean("is_bookable").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("staff_profiles_clerk_user_id_uq").on(table.clerkUserId),
    index("staff_profiles_active_idx").on(table.isActive, table.isBookable),
  ],
);

export const staffServicesTable = pgTable(
  "staff_services",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffProfilesTable.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => servicesTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.staffId, table.serviceId] }),
    index("staff_services_service_idx").on(table.serviceId),
  ],
);

export const workingHoursTable = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dayOfWeek: integer("day_of_week").notNull(),
    openTime: time("open_time").notNull(),
    closeTime: time("close_time").notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("working_hours_day_uq").on(table.dayOfWeek)],
);

export const insertStaffProfileSchema = createInsertSchema(
  staffProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkingHoursSchema = createInsertSchema(
  workingHoursTable,
).omit({ id: true, updatedAt: true });

export type InsertStaffProfile = z.infer<typeof insertStaffProfileSchema>;
export type StaffProfile = typeof staffProfilesTable.$inferSelect;
export type WorkingHours = typeof workingHoursTable.$inferSelect;