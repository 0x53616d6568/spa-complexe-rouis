import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CreateBookingBody, CreateBookingCartBody, CreateBookingResponse } from "@workspace/api-zod";
import {
  auditLogsTable,
  bookingSlotClaimsTable,
  bookingStatusHistoryTable,
  bookingServiceItemsTable,
  bookingsTable,
  customersTable,
  db,
  guestBookingTokensTable,
  notificationsTable,
  servicesTable,
  spaSettingsTable,
} from "@workspace/db";
import { listAvailableSlotsForServices } from "../availability/availability.service";
import { HttpError } from "../shared/http-error";
import { localDateFor, slotClaimInstants } from "../shared/time";
import { createGuestBookingManagementToken } from "../guest-bookings/management-token";

type CreateBookingInput = ReturnType<typeof CreateBookingBody.parse>;
type CreateBookingCartInput = ReturnType<typeof CreateBookingCartBody.parse>;
type NormalizedBookingInput = Omit<CreateBookingCartInput, "serviceIds"> & { serviceIds: string[] };

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
  const items = await db
    .select({ serviceName: bookingServiceItemsTable.serviceName })
    .from(bookingServiceItemsTable)
    .where(eq(bookingServiceItemsTable.bookingId, row.booking.id))
    .orderBy(bookingServiceItemsTable.position);

  return CreateBookingResponse.parse({
    id: row.booking.id,
    bookingReference: row.booking.bookingReference,
    serviceName: items.length ? items.map((item) => item.serviceName).join(" + ") : row.serviceName,
    startsAt: row.booking.startsAt,
    endsAt: row.booking.endsAt,
    durationMinutes: row.booking.durationMinutes,
    priceAmount: row.booking.priceAmount,
    currency: row.booking.currency,
    status: row.booking.status,
  });
}

export async function createGuestBooking(input: CreateBookingInput, clerkUserId?: string) {
  return createGuestBookingForServices({ ...input, serviceIds: [input.serviceId] }, clerkUserId);
}

export async function createGuestBookingCart(input: CreateBookingCartInput, clerkUserId?: string) {
  return createGuestBookingForServices(input, clerkUserId);
}

async function createGuestBookingForServices(input: NormalizedBookingInput, clerkUserId?: string) {
  const [settings] = await db.select().from(spaSettingsTable).limit(1);
  if (!settings) throw new HttpError(503, "Spa setup is incomplete.");
  if (!input.serviceIds.length || input.serviceIds.length > 8 || new Set(input.serviceIds).size !== input.serviceIds.length) {
    throw new HttpError(400, "Choose between one and eight different treatments.");
  }

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
        const items = await tx
          .select({ serviceName: bookingServiceItemsTable.serviceName })
          .from(bookingServiceItemsTable)
          .where(eq(bookingServiceItemsTable.bookingId, existing.booking.id))
          .orderBy(bookingServiceItemsTable.position);
        return CreateBookingResponse.parse({
          id: existing.booking.id,
          bookingReference: existing.booking.bookingReference,
          serviceName: items.length ? items.map((item) => item.serviceName).join(" + ") : existing.serviceName,
          startsAt: existing.booking.startsAt,
          endsAt: existing.booking.endsAt,
          durationMinutes: existing.booking.durationMinutes,
          priceAmount: existing.booking.priceAmount,
          currency: existing.booking.currency,
          status: existing.booking.status,
        });
      }

      const matchingServices = await tx
        .select()
        .from(servicesTable)
        .where(and(inArray(servicesTable.id, input.serviceIds), eq(servicesTable.isActive, true)));
      if (matchingServices.length !== input.serviceIds.length) {
        throw new HttpError(404, "A treatment in this cart is no longer available.");
      }
      const cartServices = input.serviceIds.map((id) => matchingServices.find((service) => service.id === id)!);
      const service = cartServices[0]!;
      const lastService = cartServices.at(-1)!;
      if (new Set(cartServices.map((item) => item.currency)).size > 1) {
        throw new HttpError(400, "Treatments in one reservation must use the same currency.");
      }
      const internalBufferMinutes = cartServices.slice(0, -1).reduce(
        (total, item, index) => total + item.bufferAfterMinutes + cartServices[index + 1]!.bufferBeforeMinutes,
        0,
      );
      const totalDurationMinutes = cartServices.reduce((total, item) => total + item.durationMinutes, 0) + internalBufferMinutes;
      const totalPriceAmount = cartServices.reduce((total, item) => total + Math.round(item.priceAmount * (100 - item.discountPercent) / 100), 0);
      const serviceName = cartServices.map((item) => item.name).join(" + ");

      const slots = await listAvailableSlotsForServices(
        input.serviceIds,
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
          durationMinutes: totalDurationMinutes,
          priceAmount: totalPriceAmount,
          currency: service.currency,
        })
        .returning();

      const claimStart = new Date(
        slot.startsAt.getTime() - service.bufferBeforeMinutes * 60 * 1000,
      );
      const claimEnd = new Date(
        slot.endsAt.getTime() + lastService.bufferAfterMinutes * 60 * 1000,
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

      let itemStartsAt = slot.startsAt;
      await tx.insert(bookingServiceItemsTable).values(
        cartServices.map((item, position) => {
          const startsAt = itemStartsAt;
          const endsAt = new Date(startsAt.getTime() + item.durationMinutes * 60 * 1000);
          itemStartsAt = position < cartServices.length - 1
            ? new Date(endsAt.getTime() + item.bufferAfterMinutes * 60 * 1000 + cartServices[position + 1]!.bufferBeforeMinutes * 60 * 1000)
            : endsAt;
          return {
            bookingId: booking.id,
            position,
            serviceId: item.id,
            serviceName: item.name,
            startsAt,
            endsAt,
            durationMinutes: item.durationMinutes,
            priceAmount: Math.round(item.priceAmount * (100 - item.discountPercent) / 100),
            currency: item.currency,
          };
        }),
      );

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
            serviceName,
            startsAt: slot.startsAt.toISOString(),
            timezone: settings.timezone,
            durationMinutes: totalDurationMinutes,
            priceAmount: totalPriceAmount,
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
            serviceName,
            startsAt: slot.startsAt.toISOString(),
            timezone: settings.timezone,
            durationMinutes: totalDurationMinutes,
            priceAmount: totalPriceAmount,
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
        metadata: { bookingReference, serviceIds: cartServices.map((item) => item.id) },
      });

      return CreateBookingResponse.parse({
        id: booking.id,
        bookingReference: booking.bookingReference,
        serviceName,
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
