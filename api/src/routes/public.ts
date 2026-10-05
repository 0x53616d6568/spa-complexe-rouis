import { Router, type IRouter } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import {
  CreateBookingBody,
  GetAvailabilityQueryParams,
  GetServiceParams,
} from "@workspace/api-zod";
import { getPublicService, listPublicServices } from "../modules/services/catalog.service";
import { listAvailableSlots } from "../modules/availability/availability.service";
import { createGuestBooking } from "../modules/bookings/bookings.service";
import { getPublicSpaProfile } from "../modules/settings/settings.service";
import { HttpError, sendRouteError } from "../modules/shared/http-error";
import { getGuestBooking, cancelGuestBooking } from "../modules/guest-bookings/guest-bookings.service";
import { createRateLimiter } from "../middleware/rateLimit";

const router: IRouter = Router();
const availabilityRateLimit = createRateLimiter({
  limit: 120,
  windowMs: 60_000,
  message: "Too many availability checks. Please wait a minute and try again.",
});
const bookingRateLimit = createRateLimiter({
  limit: 10,
  windowMs: 15 * 60_000,
  message: "Too many booking attempts. Please wait and try again.",
});
const guestLinkRateLimit = createRateLimiter({
  limit: 60,
  windowMs: 15 * 60_000,
  message: "Too many booking link requests. Please wait and try again.",
});
const guestCancelRateLimit = createRateLimiter({
  limit: 10,
  windowMs: 15 * 60_000,
  message: "Too many cancellation attempts. Please wait and try again.",
});

router.get("/spa", async (request, response) => {
  try {
    response.json(await getPublicSpaProfile());
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.get("/services", async (request, response) => {
  try {
    response.json(await listPublicServices());
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.get("/services/:slug", async (request, response) => {
  try {
    const params = GetServiceParams.safeParse(request.params);
    if (!params.success) throw new HttpError(400, "Invalid service address.");
    response.json(await getPublicService(params.data.slug));
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.get("/availability", availabilityRateLimit, async (request, response) => {
  try {
    const rawDate =
      typeof request.query.date === "string" ? request.query.date : "";
    const dateIsValid =
      /^\d{4}-\d{2}-\d{2}$/.test(rawDate) &&
      !Number.isNaN(new Date(`${rawDate}T00:00:00.000Z`).getTime());
    const query = GetAvailabilityQueryParams.safeParse({
      serviceId: request.query.serviceId,
      date: dateIsValid
        ? new Date(`${rawDate}T00:00:00.000Z`)
        : undefined,
    });
    if (!query.success || !dateIsValid) {
      throw new HttpError(400, "Provide a service ID and date in YYYY-MM-DD format.");
    }

    response.json(
      await listAvailableSlots(
        query.data.serviceId,
        rawDate,
      ),
    );
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.post("/bookings", bookingRateLimit, async (request, response) => {
  try {
    const parsed = CreateBookingBody.safeParse(request.body);
    if (!parsed.success) {
      throw new HttpError(400, "Check the booking details and try again.");
    }
    let customerAccountId: string | undefined;
    const userId = getAuth(request).userId;
    if (userId) {
      try {
        const user = await clerkClient.users.getUser(userId);
        const normalizedEmail = parsed.data.customerEmail.trim().toLowerCase();
        const isVerifiedAccountEmail = user.emailAddresses.some(
          (address) =>
            address.emailAddress.trim().toLowerCase() === normalizedEmail &&
            address.verification?.status === "verified",
        );
        if (isVerifiedAccountEmail) customerAccountId = userId;
      } catch (error) {
        request.log?.warn({ error, userId }, "Could not link booking to the signed-in customer account");
      }
    }
    response.status(201).json(await createGuestBooking(parsed.data, customerAccountId));
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.get("/guest-bookings/manage", guestLinkRateLimit, async (request, response) => {
  try {
    const token = typeof request.query.token === "string" ? request.query.token : "";
    if (typeof token !== "string") throw new HttpError(404, "This booking link is invalid or has expired.");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.json(await getGuestBooking(token));
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.post("/guest-bookings/manage/cancel", guestCancelRateLimit, async (request, response) => {
  try {
    const token = typeof request.query.token === "string" ? request.query.token : "";
    if (typeof token !== "string") throw new HttpError(404, "This booking link is invalid or has expired.");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.json(await cancelGuestBooking(token));
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

export default router;
