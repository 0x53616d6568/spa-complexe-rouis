import { eq, or, asc } from "drizzle-orm";
import {
  GetServiceResponse,
  ListServicesResponse,
} from "@workspace/api-zod";
import {
  db,
  serviceCategoriesTable,
  servicesTable,
} from "@workspace/db";
import { HttpError } from "../shared/http-error";

function toPublicService(row: {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  durationMinutes: number;
  priceAmount: number;
  discountPercent: number;
  currency: string;
  imageUrl: string | null;
  isFeatured: boolean;
}) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    shortDescription: row.shortDescription,
    description: row.description,
    durationMinutes: row.durationMinutes,
    originalPriceAmount: row.priceAmount,
    discountPercent: row.discountPercent,
    priceAmount: Math.round(row.priceAmount * (100 - row.discountPercent) / 100),
    currency: row.currency,
    imageUrl: row.imageUrl,
    isFeatured: row.isFeatured,
  };
}

export async function listPublicServices() {
  const rows = await db
    .select({
      id: servicesTable.id,
      slug: servicesTable.slug,
      name: servicesTable.name,
      category: serviceCategoriesTable.name,
      shortDescription: servicesTable.shortDescription,
      description: servicesTable.description,
      durationMinutes: servicesTable.durationMinutes,
      priceAmount: servicesTable.priceAmount,
      discountPercent: servicesTable.discountPercent,
      currency: servicesTable.currency,
      imageUrl: servicesTable.imageUrl,
      isFeatured: servicesTable.isFeatured,
    })
    .from(servicesTable)
    .innerJoin(
      serviceCategoriesTable,
      eq(servicesTable.categoryId, serviceCategoriesTable.id),
    )
    .where(eq(servicesTable.isActive, true))
    .orderBy(asc(serviceCategoriesTable.sortOrder), asc(servicesTable.name));

  return ListServicesResponse.parse(rows.map(toPublicService));
}

export async function getPublicService(slug: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const whereClause = isUuid
    ? or(eq(servicesTable.slug, slug), eq(servicesTable.id, slug))
    : eq(servicesTable.slug, slug);

  const [row] = await db
    .select({
      id: servicesTable.id,
      slug: servicesTable.slug,
      name: servicesTable.name,
      category: serviceCategoriesTable.name,
      shortDescription: servicesTable.shortDescription,
      description: servicesTable.description,
      durationMinutes: servicesTable.durationMinutes,
      priceAmount: servicesTable.priceAmount,
      discountPercent: servicesTable.discountPercent,
      currency: servicesTable.currency,
      imageUrl: servicesTable.imageUrl,
      isFeatured: servicesTable.isFeatured,
    })
    .from(servicesTable)
    .innerJoin(
      serviceCategoriesTable,
      eq(servicesTable.categoryId, serviceCategoriesTable.id),
    )
    .where(whereClause)
    .limit(1);

  if (!row) {
    throw new HttpError(404, "Service not found.");
  }
  return GetServiceResponse.parse(toPublicService(row));
}
