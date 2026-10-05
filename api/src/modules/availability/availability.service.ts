import { and, eq, gte, lt } from "drizzle-orm";
import type { AvailabilitySlot } from "@workspace/api-zod";
import {
  bookingSlotClaimsTable,
  db,
  servicesTable,
  spaSettingsTable,
  workingHoursTable,
} from "@workspace/db";
import { HttpError } from "../shared/http-error";
import {
  addCalendarDays,
  formatMinutesAsTime,
  localDateTimeLabel,
  localDateTimeToUtc,
  localWeekday,
  minutesSinceMidnight,
  slotClaimInstants,
} from "../shared/time";

export async function listAvailableSlots(
  serviceId: string,
  localDate: string,
  executor: typeof db = db,
): Promise<AvailabilitySlot[]> {
  const [service] = await executor
    .select()
    .from(servicesTable)
    .where(and(eq(servicesTable.id, serviceId), eq(servicesTable.isActive, true)))
    .limit(1);
  if (!service) throw new HttpError(404, "Service not found.");

  const [settings] = await executor.select().from(spaSettingsTable).limit(1);
  if (!settings) throw new HttpError(503, "Spa setup is incomplete.");

  const [hours] = await executor
    .select()
    .from(workingHoursTable)
    .where(eq(workingHoursTable.dayOfWeek, localWeekday(localDate)))
    .limit(1);
  if (!hours || hours.isClosed) return [];

  const nextDate = addCalendarDays(localDate, 1);
  const dayStart = localDateTimeToUtc(localDate, "00:00", settings.timezone);
  const dayEnd = localDateTimeToUtc(nextDate, "00:00", settings.timezone);
  if (!dayStart || !dayEnd) return [];

  const claims = await executor
    .select({ slotStartsAt: bookingSlotClaimsTable.slotStartsAt })
    .from(bookingSlotClaimsTable)
    .where(
      and(
        gte(bookingSlotClaimsTable.slotStartsAt, dayStart),
        lt(bookingSlotClaimsTable.slotStartsAt, dayEnd),
      ),
    );
  const claimedInstants = new Set(
    claims.map((claim) => claim.slotStartsAt.getTime()),
  );

  const openMinute = minutesSinceMidnight(hours.openTime);
  const closeMinute = minutesSinceMidnight(hours.closeTime);
  const firstStartMinute = openMinute + service.bufferBeforeMinutes;
  const lastStartMinute =
    closeMinute -
    service.durationMinutes -
    service.bufferAfterMinutes;
  const minimumStart =
    Date.now() + settings.minimumNoticeHours * 60 * 60 * 1000;
  const maximumStart =
    Date.now() + settings.bookingWindowDays * 24 * 60 * 60 * 1000;
  const slots: AvailabilitySlot[] = [];

  for (
    let startMinute = firstStartMinute;
    startMinute <= lastStartMinute;
    startMinute += 30
  ) {
    const start = localDateTimeToUtc(
      localDate,
      formatMinutesAsTime(startMinute),
      settings.timezone,
    );
    if (!start || start.getTime() < minimumStart || start.getTime() > maximumStart) {
      continue;
    }

    const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);
    const claimsForSlot = slotClaimInstants(
      new Date(start.getTime() - service.bufferBeforeMinutes * 60 * 1000),
      new Date(end.getTime() + service.bufferAfterMinutes * 60 * 1000),
    );
    if (claimsForSlot.some((claim) => claimedInstants.has(claim.getTime()))) {
      continue;
    }

    slots.push({
      startsAt: start,
      endsAt: end,
      label: localDateTimeLabel(start, settings.timezone),
    });
  }

  return slots;
}