import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  serviceCategoriesTable,
  servicesTable,
  spaSettingsTable,
  staffProfilesTable,
  staffServicesTable,
  workingHoursTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

const demoSettingsId = "00000000-0000-4000-8000-000000000001";

async function findOrCreateCategory(name: string, slug: string, sortOrder: number) {
  const [found] = await db
    .select()
    .from(serviceCategoriesTable)
    .where(eq(serviceCategoriesTable.slug, slug))
    .limit(1);

  if (found) return found.id;

  const [created] = await db
    .insert(serviceCategoriesTable)
    .values({ name, slug, sortOrder })
    .returning();
  return created.id;
}

async function seed() {
  await db
    .insert(spaSettingsTable)
    .values({
      id: demoSettingsId,
      name: "Your Spa Name",
      tagline: "A considered pause, close to home.",
      address: "Update spa address",
      city: "Update city",
      region: "Update region",
      contactEmail: "hello@example.com",
      contactPhone: "Update spa phone",
      timezone: "Africa/Lagos",
      currency: "NGN",
      cancellationPolicy:
        "Demo policy. Replace this with your spa's approved cancellation terms before accepting real bookings.",
      bookingWindowDays: 60,
      minimumNoticeHours: 2,
      isDemo: true,
    })
    .onConflictDoNothing();

  const massageCategoryId = await findOrCreateCategory("Massage", "massage", 1);
  const facialCategoryId = await findOrCreateCategory("Facials", "facials", 2);
  const bodyCategoryId = await findOrCreateCategory("Body treatments", "body-treatments", 3);

  const services = [
    {
      categoryId: massageCategoryId,
      name: "Restorative Massage",
      slug: "restorative-massage",
      shortDescription: "A full-body massage with a steady, soothing rhythm.",
      description:
        "Demo service description. Replace this with accurate treatment details, preparation notes, and aftercare.",
      durationMinutes: 60,
      priceAmount: 2_500_000,
      currency: "NGN",
      isFeatured: true,
    },
    {
      categoryId: facialCategoryId,
      name: "Custom Facial",
      slug: "custom-facial",
      shortDescription: "A facial appointment tailored to your preferences.",
      description:
        "Demo service description. Replace this with accurate treatment details, preparation notes, and aftercare.",
      durationMinutes: 60,
      priceAmount: 2_800_000,
      currency: "NGN",
      isFeatured: true,
    },
    {
      categoryId: bodyCategoryId,
      name: "Aromatic Body Ritual",
      slug: "aromatic-body-ritual",
      shortDescription: "A slow, sensory body treatment with time to unwind.",
      description:
        "Demo service description. Replace this with accurate treatment details, preparation notes, and aftercare.",
      durationMinutes: 90,
      priceAmount: 3_800_000,
      currency: "NGN",
      isFeatured: true,
    },
  ];

  for (const service of services) {
    await db.insert(servicesTable).values(service).onConflictDoNothing();
  }

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    await db
      .insert(workingHoursTable)
      .values({
        dayOfWeek,
        openTime: "09:00",
        closeTime: "18:00",
        isClosed: false,
      })
      .onConflictDoNothing();
  }

  const [massage] = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.slug, "restorative-massage"))
    .limit(1);
  const [facial] = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.slug, "custom-facial"))
    .limit(1);
  const [body] = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.slug, "aromatic-body-ritual"))
    .limit(1);

  const staffSeeds = [
    {
      displayName: "Sample therapist 1",
      bio: "Demo staff profile. Replace with an approved therapist biography.",
      serviceIds: [massage.id, body.id],
    },
    {
      displayName: "Sample therapist 2",
      bio: "Demo staff profile. Replace with an approved therapist biography.",
      serviceIds: [massage.id, facial.id],
    },
  ];

  for (const staffSeed of staffSeeds) {
    let [staff] = await db
      .select()
      .from(staffProfilesTable)
      .where(eq(staffProfilesTable.displayName, staffSeed.displayName))
      .limit(1);

    if (!staff) {
      [staff] = await db
        .insert(staffProfilesTable)
        .values({
          displayName: staffSeed.displayName,
          bio: staffSeed.bio,
          isBookable: true,
          isActive: true,
        })
        .returning();
    }

    for (const serviceId of staffSeed.serviceIds) {
      await db
        .insert(staffServicesTable)
        .values({ staffId: staff.id, serviceId })
        .onConflictDoNothing();
    }
  }

  logger.info("Demo spa data is ready; replace the placeholder business details before launch");
}

seed()
  .catch((error: unknown) => {
    logger.error({ error }, "Failed to seed spa demo data");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });