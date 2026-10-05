import { asc, eq } from "drizzle-orm";
import { db, spaSettingsTable, workingHoursTable } from "@workspace/db";
import { GetSpaProfileResponse } from "@workspace/api-zod";
import { HttpError } from "../shared/http-error";

export async function getSpaSettings(executor: typeof db = db) {
  const [settings] = await executor.select().from(spaSettingsTable).limit(1);
  if (!settings) {
    throw new HttpError(
      503,
      "Spa setup is incomplete. Seed the database before accepting requests.",
    );
  }
  return settings;
}

export async function getPublicSpaProfile() {
  const settings = await getSpaSettings();
  const hours = await db
    .select()
    .from(workingHoursTable)
    .orderBy(asc(workingHoursTable.dayOfWeek));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const openingHours = hours
    .map((day) =>
      day.isClosed
        ? `${days[day.dayOfWeek]}: closed`
        : `${days[day.dayOfWeek]}: ${day.openTime.slice(0, 5)}–${day.closeTime.slice(0, 5)}`,
    )
    .join(" · ");

  return GetSpaProfileResponse.parse({
    name: settings.name,
    tagline: settings.tagline,
    address: settings.address,
    city: settings.city,
    region: settings.region,
    contactEmail: settings.contactEmail,
    contactPhone: settings.contactPhone,
    timezone: settings.timezone,
    openingHours: openingHours || "Hours to be confirmed",
    cancellationPolicy: settings.cancellationPolicy,
  });
}

export async function getSettingsById(id: string) {
  const [settings] = await db
    .select()
    .from(spaSettingsTable)
    .where(eq(spaSettingsTable.id, id))
    .limit(1);
  if (!settings) throw new HttpError(404, "Spa settings not found.");
  return settings;
}