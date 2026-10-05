import { and, eq, gt, isNull } from "drizzle-orm";
import {
  auditLogsTable,
  bookingSlotClaimsTable,
  bookingStatusHistoryTable,
  bookingsTable,
  customersTable,
  db,
  guestBookingTokensTable,
  notificationsTable,
  servicesTable,
  spaSettingsTable,
} from "@workspace/db";
import { HttpError } from "../shared/http-error";
import { hashGuestBookingManagementToken } from "./management-token";

function invalidToken(): HttpError {
  return new HttpError(404, "This booking link is invalid or has expired.");
}

export async function getGuestBooking(token: string) {
  const tokenHash = hashGuestBookingManagementToken(token);
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        token: guestBookingTokensTable,
        booking: bookingsTable,
        customerName: customersTable.name,
        serviceName: servicesTable.name,
      })
      .from(guestBookingTokensTable)
      .innerJoin(bookingsTable, eq(guestBookingTokensTable.bookingId, bookingsTable.id))
      .innerJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
      .innerJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(
        and(
          eq(guestBookingTokensTable.tokenHash, tokenHash),
          isNull(guestBookingTokensTable.usedAt),
          gt(guestBookingTokensTable.expiresAt, new Date()),
        ),
      )
      .for("update")
      .limit(1);
    if (!row) throw invalidToken();

    return {
    bookingReference: row.booking.bookingReference,
    customerName: row.customerName,
    serviceName: row.serviceName,
    startsAt: row.booking.startsAt,
    endsAt: row.booking.endsAt,
    timezone: row.booking.timezone,
    status: row.booking.status,
    durationMinutes: row.booking.durationMinutes,
    priceAmount: row.booking.priceAmount,
    currency: row.booking.currency,
    canCancel:
      ["pending", "confirmed"].includes(row.booking.status) &&
      row.booking.startsAt.getTime() > Date.now(),
    };
  });
}

export async function cancelGuestBooking(token: string) {
  const tokenHash = hashGuestBookingManagementToken(token);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        token: guestBookingTokensTable,
        booking: bookingsTable,
        customer: customersTable,
        service: servicesTable,
      })
      .from(guestBookingTokensTable)
      .innerJoin(bookingsTable, eq(guestBookingTokensTable.bookingId, bookingsTable.id))
      .innerJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
      .innerJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(
        and(
          eq(guestBookingTokensTable.tokenHash, tokenHash),
          isNull(guestBookingTokensTable.usedAt),
          gt(guestBookingTokensTable.expiresAt, new Date()),
        ),
      )
      .for("update")
      .limit(1);
    if (!row) throw invalidToken();

    const [settings] = await tx.select().from(spaSettingsTable).limit(1);
    if (
      !["pending", "confirmed"].includes(row.booking.status) ||
      row.booking.startsAt.getTime() <= Date.now()
    ) {
      throw new HttpError(409, "This appointment can no longer be cancelled online.");
    }

    const now = new Date();
    await tx
      .update(guestBookingTokensTable)
      .set({ usedAt: now })
      .where(eq(guestBookingTokensTable.id, row.token.id));
    await tx
      .update(bookingsTable)
      .set({ status: "cancelled", cancellationReason: "Cancelled by guest", updatedAt: now })
      .where(eq(bookingsTable.id, row.booking.id));
    await tx
      .delete(bookingSlotClaimsTable)
      .where(eq(bookingSlotClaimsTable.bookingId, row.booking.id));
    await tx.insert(bookingStatusHistoryTable).values({
      bookingId: row.booking.id,
      fromStatus: row.booking.status,
      toStatus: "cancelled",
      changedBy: "guest",
      reason: "Cancelled by guest",
    });
    await tx.insert(auditLogsTable).values({
      actorId: null,
      actorLabel: "Guest",
      action: "booking.status_cancelled",
      entityType: "booking",
      entityId: row.booking.id,
      metadata: { bookingReference: row.booking.bookingReference },
    });
    if (settings) {
      await tx.insert(notificationsTable).values({
        bookingId: row.booking.id,
        customerId: row.customer.id,
        templateKey: "booking_cancelled",
        recipient: row.customer.email,
        payload: {
          spaName: settings.name,
          customerName: row.customer.name,
          bookingReference: row.booking.bookingReference,
          serviceName: row.service.name,
          startsAt: row.booking.startsAt.toISOString(),
          timezone: row.booking.timezone,
          durationMinutes: row.booking.durationMinutes,
          priceAmount: row.booking.priceAmount,
          currency: row.booking.currency,
          cancellationReason: "Cancelled by guest",
        },
      });
    }
  });

  return { cancelled: true };
}
