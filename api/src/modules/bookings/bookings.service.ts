import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { CreateBookingBody, CreateBookingResponse } from "@workspace/api-zod";
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
import { listAvailableSlots } from "../availability/availability.service";
import { HttpError } from "../shared/http-error";
import { localDateFor, slotClaimInstants } from "../shared/time";
import { createGuestBookingManagementToken } from "../guest-bookings/management-token";

type CreateBookingInput = ReturnType<typeof CreateBookingBody.parse>;

function postgresError(error: unknown): { code?: string; constraint?: string } {
  if (!error || typeof error !== "object") return {};
  const value = error as { code?: unknown; constraint?: unknown };
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    constraint:
      typeof value.constraint === "string" ? value.constraint : undefined,
  };
}

async function getExistingConfirmation(idempotencyKey: string) {
  const [row] = await db
    .select({
      booking: bookingsTable,
      serviceName: servicesTable.name,
    })
    .from(bookingsTable)
    .innerJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .where(eq(bookingsTable.idempotencyKey, idempotencyKey))
    .limit(1);
  if (!row) return null;

  return CreateBookingResponse.parse({
    id: row.booking.id,
    bookingReference: row.booking.bookingReference,
    serviceName: row.serviceName,
    startsAt: row.booking.startsAt,
    endsAt: row.booking.endsAt,
    durationMinutes: row.booking.durationMinutes,
    priceAmount: row.booking.priceAmount,
    currency: row.booking.currency,
    status: row.booking.status,
  });
}

export async function createGuestBooking(input: CreateBookingInput, clerkUserId?: string) {
  const [settings] = await db.select().from(spaSettingsTable).limit(1);
  if (!settings) throw new HttpError(503, "Spa setup is incomplete.");

  const localDate = localDateFor(input.startsAt, settings.timezone);

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${localDate}))`,
      );

      const [existing] = await tx
        .select({
          booking: bookingsTable,
          serviceName: servicesTable.name,
        })
        .from(bookingsTable)
        .innerJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
        .where(eq(bookingsTable.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing) {
        return CreateBookingResponse.parse({
          id: existing.booking.id,
          bookingReference: existing.booking.bookingReference,
          serviceName: existing.serviceName,
          startsAt: existing.booking.startsAt,
          endsAt: existing.booking.endsAt,
          durationMinutes: existing.booking.durationMinutes,
          priceAmount: existing.booking.priceAmount,
          currency: existing.booking.currency,
          status: existing.booking.status,
        });
      }

      const [service] = await tx
        .select()
        .from(servicesTable)
        .where(and(eq(servicesTable.id, input.serviceId), eq(servicesTable.isActive, true)))
        .limit(1);
      if (!service) throw new HttpError(404, "Service not found.");

      const slots = await listAvailableSlots(
        input.serviceId,
        localDate,
        tx as unknown as typeof db,
      );
      const slot = slots.find(
        (candidate) =>
          candidate.startsAt.getTime() === input.startsAt.getTime(),
      );
      if (!slot) {
        throw new HttpError(
          409,
          "That time is no longer available. Choose another appointment time.",
        );
      }

      const customerEmail = input.customerEmail.trim().toLowerCase();
      let customerAccountId = clerkUserId;
      if (customerAccountId) {
        const [existingAccountCustomer] = await tx
          .select({ email: customersTable.email })
          .from(customersTable)
          .where(eq(customersTable.clerkUserId, customerAccountId))
          .limit(1);
        if (existingAccountCustomer && existingAccountCustomer.email !== customerEmail) {
          customerAccountId = undefined;
        }
      }
      const [customer] = await tx
        .insert(customersTable)
        .values({
          email: customerEmail,
          name: input.customerName.trim(),
          phone: input.customerPhone.trim(),
        })
        .onConflictDoUpdate({
          target: customersTable.email,
          set: {
            name: input.customerName.trim(),
            phone: input.customerPhone.trim(),
            updatedAt: new Date(),
            ...(customerAccountId
              ? { clerkUserId: sql`coalesce(${customersTable.clerkUserId}, ${customerAccountId})` }
              : {}),
          },
        })
        .returning();

      const bookingReference = `SPA-${randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;
      const [booking] = await tx
        .insert(bookingsTable)
        .values({
          bookingReference,
          idempotencyKey: input.idempotencyKey,
          customerId: customer.id,
          serviceId: service.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          timezone: settings.timezone,
          status: "pending",
          customerNote: input.customerNote?.trim() || null,
          durationMinutes: service.durationMinutes,
          priceAmount: service.priceAmount,
          currency: service.currency,
        })
        .returning();

      const claimStart = new Date(
        slot.startsAt.getTime() - service.bufferBeforeMinutes * 60 * 1000,
      );
      const claimEnd = new Date(
        slot.endsAt.getTime() + service.bufferAfterMinutes * 60 * 1000,
      );
      await tx.insert(bookingSlotClaimsTable).values(
        slotClaimInstants(claimStart, claimEnd).map((slotStartsAt) => ({
          bookingId: booking.id,
          slotStartsAt,
        })),
      );

      await tx.insert(bookingStatusHistoryTable).values({
        bookingId: booking.id,
        fromStatus: null,
        toStatus: "pending",
        changedBy: "guest",
        reason: null,
      });

      if (process.env.GUEST_BOOKING_MANAGEMENT_SECRET && process.env.PUBLIC_APP_URL) {
        const [notification] = await tx.insert(notificationsTable).values({
          bookingId: booking.id,
          customerId: customer.id,
          templateKey: "booking_created",
          recipient: customer.email,
          payload: {
            spaName: settings.name,
            customerName: customer.name,
            bookingReference,
            serviceName: service.name,
            startsAt: slot.startsAt.toISOString(),
            timezone: settings.timezone,
            durationMinutes: service.durationMinutes,
            priceAmount: service.priceAmount,
            currency: service.currency,
            cancellationPolicy: settings.cancellationPolicy,
          },
        }).returning({ id: notificationsTable.id });
        const management = createGuestBookingManagementToken(notification.id, booking.id);
        await tx.insert(guestBookingTokensTable).values({
          bookingId: booking.id,
          tokenHash: management.tokenHash,
          expiresAt: management.expiresAt,
        });
      }

      if (!process.env.GUEST_BOOKING_MANAGEMENT_SECRET || !process.env.PUBLIC_APP_URL) {
        await tx.insert(notificationsTable).values({
          bookingId: booking.id,
          customerId: customer.id,
          templateKey: "booking_created",
          recipient: customer.email,
          payload: {
            spaName: settings.name,
            customerName: customer.name,
            bookingReference,
            serviceName: service.name,
            startsAt: slot.startsAt.toISOString(),
            timezone: settings.timezone,
            durationMinutes: service.durationMinutes,
            priceAmount: service.priceAmount,
            currency: service.currency,
            cancellationPolicy: settings.cancellationPolicy,
          },
        });
      }

      await tx.insert(auditLogsTable).values({
        actorId: customerAccountId ?? null,
        actorLabel: customerAccountId ? "Customer account" : "Guest",
        action: "booking.created",
        entityType: "booking",
        entityId: booking.id,
        metadata: { bookingReference, serviceId: service.id },
      });

      return CreateBookingResponse.parse({
        id: booking.id,
        bookingReference: booking.bookingReference,
        serviceName: service.name,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        durationMinutes: booking.durationMinutes,
        priceAmount: booking.priceAmount,
        currency: booking.currency,
        status: booking.status,
      });
    });
  } catch (error) {
    const databaseError = postgresError(error);
    if (
      databaseError.code === "23505" &&
      databaseError.constraint === "booking_slot_claims_start_uq"
    ) {
      throw new HttpError(
        409,
        "That time is no longer available. Choose another appointment time.",
      );
    }

    if (
      databaseError.code === "23505" &&
      databaseError.constraint === "bookings_idempotency_key_uq"
    ) {
      const confirmation = await getExistingConfirmation(input.idempotencyKey);
      if (confirmation) return confirmation;
    }

    throw error;
  }
}
