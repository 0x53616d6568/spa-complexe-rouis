import { and, asc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import {
  AssignBookingStaffResponse,
  GetManagerDashboardResponse,
  ListManagerBookingsResponse,
  ListManagerStaffResponse,
  UpdateBookingStatusResponse,
  type ManagerBooking,
} from "@workspace/api-zod";
import {
  auditLogsTable,
  bookingSlotClaimsTable,
  bookingStatusHistoryTable,
  bookingServiceItemsTable,
  bookingsTable,
  customersTable,
  db,
  notificationsTable,
  servicesTable,
  spaSettingsTable,
  staffProfilesTable,
  staffServicesTable,
} from "@workspace/db";
import { HttpError } from "../shared/http-error";
import { addCalendarDays, localDateFor, localDateTimeToUtc } from "../shared/time";
import { getSpaSettings } from "../settings/settings.service";
import type { SpaPermission, SpaRole } from "../auth/authorization";

export interface SpaActor {
  id: string;
  role: SpaRole;
  permissions: readonly SpaPermission[];
  label: string;
}

async function getManagerBookingById(id: string, executor: typeof db = db) {
  const [row] = await executor
    .select({
      id: bookingsTable.id,
      serviceId: bookingsTable.serviceId,
      bookingReference: bookingsTable.bookingReference,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      customerPhone: customersTable.phone,
      serviceName: servicesTable.name,
      staffName: staffProfilesTable.displayName,
      startsAt: bookingsTable.startsAt,
      endsAt: bookingsTable.endsAt,
      status: bookingsTable.status,
    })
    .from(bookingsTable)
    .innerJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .innerJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .leftJoin(staffProfilesTable, eq(bookingsTable.staffId, staffProfilesTable.id))
    .where(eq(bookingsTable.id, id))
    .limit(1);
  if (!row) return null;
  const items = await executor
    .select({ serviceName: bookingServiceItemsTable.serviceName })
    .from(bookingServiceItemsTable)
    .where(eq(bookingServiceItemsTable.bookingId, id))
    .orderBy(asc(bookingServiceItemsTable.position));
  return { ...row, serviceName: items.length ? items.map((item) => item.serviceName).join(" + ") : row.serviceName };
}

async function rowsForLocalDate(localDate: string) {
  const settings = await getSpaSettings();
  const start = localDateTimeToUtc(localDate, "00:00", settings.timezone);
  const end = localDateTimeToUtc(
    addCalendarDays(localDate, 1),
    "00:00",
    settings.timezone,
  );
  if (!start || !end) throw new HttpError(400, "Invalid calendar date.");

  const rows = await db
    .select({
      id: bookingsTable.id,
      serviceId: bookingsTable.serviceId,
      bookingReference: bookingsTable.bookingReference,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      customerPhone: customersTable.phone,
      serviceName: servicesTable.name,
      staffName: staffProfilesTable.displayName,
      startsAt: bookingsTable.startsAt,
      endsAt: bookingsTable.endsAt,
      status: bookingsTable.status,
    })
    .from(bookingsTable)
    .innerJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .innerJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .leftJoin(staffProfilesTable, eq(bookingsTable.staffId, staffProfilesTable.id))
    .where(
      and(
        gte(bookingsTable.startsAt, start),
        lt(bookingsTable.startsAt, end),
      ),
    )
    .orderBy(asc(bookingsTable.startsAt));
  if (!rows.length) return rows;
  const items = await db
    .select({ bookingId: bookingServiceItemsTable.bookingId, serviceName: bookingServiceItemsTable.serviceName, position: bookingServiceItemsTable.position })
    .from(bookingServiceItemsTable)
    .where(inArray(bookingServiceItemsTable.bookingId, rows.map((row) => row.id)))
    .orderBy(asc(bookingServiceItemsTable.position));
  const namesByBooking = new Map<string, string[]>();
  for (const item of items) namesByBooking.set(item.bookingId, [...(namesByBooking.get(item.bookingId) ?? []), item.serviceName]);
  return rows.map((row) => ({ ...row, serviceName: namesByBooking.get(row.id)?.join(" + ") ?? row.serviceName }));
}

export async function listManagerBookings(localDate?: string) {
  const settings = await getSpaSettings();
  const date = localDate ?? localDateFor(new Date(), settings.timezone);
  const rows = await rowsForLocalDate(date);
  return ListManagerBookingsResponse.parse(rows);
}

export async function getManagerDashboard() {
  const settings = await getSpaSettings();
  const date = localDateFor(new Date(), settings.timezone);
  const bookings = await rowsForLocalDate(date);
  const active = bookings.filter(
    (booking) => !["cancelled", "no_show"].includes(booking.status),
  );
  const nextBooking =
    active.find(
      (booking) =>
        booking.startsAt.getTime() >= Date.now() &&
        ["pending", "confirmed"].includes(booking.status),
    ) ?? null;

  return GetManagerDashboardResponse.parse({
    todayCount: active.length,
    pendingCount: bookings.filter((booking) => booking.status === "pending").length,
    completedCount: bookings.filter((booking) => booking.status === "completed").length,
    nextBooking,
  });
}

export async function listAssignableStaff() {
  const staff = await db
    .select({
      id: staffProfilesTable.id,
      displayName: staffProfilesTable.displayName,
      bio: staffProfilesTable.bio,
      isActive: staffProfilesTable.isActive,
    })
    .from(staffProfilesTable)
    .where(
      and(
        eq(staffProfilesTable.isActive, true),
        eq(staffProfilesTable.isBookable, true),
      ),
    )
    .orderBy(asc(staffProfilesTable.displayName));

  if (!staff.length) return ListManagerStaffResponse.parse([]);

  const serviceLinks = await db
    .select({
      staffId: staffServicesTable.staffId,
      serviceId: staffServicesTable.serviceId,
    })
    .from(staffServicesTable)
    .where(inArray(staffServicesTable.staffId, staff.map((person) => person.id)));
  const servicesByStaff = new Map<string, string[]>();
  for (const link of serviceLinks) {
    const serviceIds = servicesByStaff.get(link.staffId) ?? [];
    serviceIds.push(link.serviceId);
    servicesByStaff.set(link.staffId, serviceIds);
  }

  return ListManagerStaffResponse.parse(
    staff.map((person) => ({
      ...person,
      serviceIds: servicesByStaff.get(person.id) ?? [],
    })),
  );
}

export async function assignBookingStaff(
  bookingId: string,
  staffId: string | null,
  actor: SpaActor,
) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${staffId ?? bookingId}))`,
    );
    const [booking] = await tx
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
    if (!booking) throw new HttpError(404, "Booking not found.");
    if (["cancelled", "completed", "no_show"].includes(booking.status)) {
      throw new HttpError(409, "A finished or cancelled booking cannot be assigned.");
    }

    if (staffId) {
      const [staff] = await tx
        .select()
        .from(staffProfilesTable)
        .where(
          and(
            eq(staffProfilesTable.id, staffId),
            eq(staffProfilesTable.isActive, true),
            eq(staffProfilesTable.isBookable, true),
          ),
        )
        .limit(1);
      if (!staff) throw new HttpError(404, "Active therapist not found.");

      const [qualification] = await tx
        .select()
        .from(staffServicesTable)
        .where(
          and(
            eq(staffServicesTable.staffId, staffId),
            eq(staffServicesTable.serviceId, booking.serviceId),
          ),
        )
        .limit(1);
      if (!qualification) {
        throw new HttpError(409, "This therapist is not listed for the selected service.");
      }

      const [conflict] = await tx
        .select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.staffId, staffId),
            sql`${bookingsTable.id} <> ${bookingId}`,
            lt(bookingsTable.startsAt, booking.endsAt),
            gt(bookingsTable.endsAt, booking.startsAt),
            inArray(bookingsTable.status, ["pending", "confirmed", "checked_in"]),
          ),
        )
        .limit(1);
      if (conflict) {
        throw new HttpError(409, "This therapist already has an appointment at that time.");
      }
    }

    if (booking.staffId === staffId) return;

    await tx
      .update(bookingsTable)
      .set({ staffId, updatedAt: new Date() })
      .where(eq(bookingsTable.id, bookingId));
    await tx.insert(auditLogsTable).values({
      actorId: actor.id,
      actorLabel: actor.label,
      action: staffId ? "booking.staff_assigned" : "booking.staff_unassigned",
      entityType: "booking",
      entityId: bookingId,
      metadata: { previousStaffId: booking.staffId, staffId },
    });
  });

  const result = await getManagerBookingById(bookingId);
  if (!result) throw new HttpError(404, "Booking not found.");
  return AssignBookingStaffResponse.parse(result);
}

const allowedTransitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export async function updateBookingStatus(
  bookingId: string,
  nextStatus: "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show",
  reason: string | null | undefined,
  actor: SpaActor,
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${bookingId}))`);
    const [booking] = await tx
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);
    if (!booking) throw new HttpError(404, "Booking not found.");
    if (booking.status === nextStatus) return;
    if (!allowedTransitions[booking.status]?.includes(nextStatus)) {
      throw new HttpError(
        409,
        `A booking cannot move from ${booking.status.replaceAll("_", " ")} to ${nextStatus.replaceAll("_", " ")}.`,
      );
    }

    const [settings] = await tx.select().from(spaSettingsTable).limit(1);
    const [customer] = await tx
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, booking.customerId))
      .limit(1);
    const [service] = await tx
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, booking.serviceId))
      .limit(1);

    await tx
      .update(bookingsTable)
      .set({
        status: nextStatus,
        cancellationReason: nextStatus === "cancelled" ? reason?.trim() || null : null,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    if (nextStatus === "cancelled") {
      await tx
        .delete(bookingSlotClaimsTable)
        .where(eq(bookingSlotClaimsTable.bookingId, bookingId));
    }

    await tx.insert(bookingStatusHistoryTable).values({
      bookingId,
      fromStatus: booking.status,
      toStatus: nextStatus,
      changedBy: actor.id,
      reason: reason?.trim() || null,
    });
    await tx.insert(auditLogsTable).values({
      actorId: actor.id,
      actorLabel: actor.label,
      action: `booking.status_${nextStatus}`,
      entityType: "booking",
      entityId: bookingId,
      metadata: { fromStatus: booking.status, toStatus: nextStatus },
    });

    if (
      settings &&
      customer &&
      service &&
      ["confirmed", "cancelled"].includes(nextStatus)
    ) {
      await tx.insert(notificationsTable).values({
        bookingId,
        customerId: customer.id,
        templateKey: `booking_${nextStatus}`,
        recipient: customer.email,
        payload: {
          spaName: settings.name,
          customerName: customer.name,
          bookingReference: booking.bookingReference,
          serviceName: service.name,
          startsAt: booking.startsAt.toISOString(),
          timezone: booking.timezone,
          durationMinutes: booking.durationMinutes,
          priceAmount: booking.priceAmount,
          currency: booking.currency,
          cancellationPolicy: settings.cancellationPolicy,
          cancellationReason: reason?.trim() || "",
        },
      });
    }
  });

  const result = await getManagerBookingById(bookingId);
  if (!result) throw new HttpError(404, "Booking not found.");
  return UpdateBookingStatusResponse.parse(result) as ManagerBooking;
}
