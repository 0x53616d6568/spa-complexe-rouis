import { and, asc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  auditLogsTable,
  customersTable,
  db,
  serviceCategoriesTable,
  servicesTable,
  staffProfilesTable,
} from "@workspace/db";
import { HttpError } from "../shared/http-error";
import { clearSpaAccessCache, getEffectiveSpaPermissions, rolePermissions, spaPermissions, type SpaPermission } from "../auth/authorization";
import type { SpaActor } from "./manager.service";

type ServiceInput = {
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  durationMinutes: number;
  priceAmount: number;
  discountPercent?: number;
  currency: string;
  isFeatured?: boolean;
  imageUrl?: string | null;
};

type StaffInput = {
  displayName: string;
  bio?: string;
  isBookable?: boolean;
  isActive?: boolean;
  accountEmail?: string;
  password?: string;
  role?: "user" | "manager" | "admin";
  permissions?: SpaPermission[];
  accountDisabled?: boolean;
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function categoryIdFor(name: string, executor: typeof db = db) {
  const categoryName = name.trim();
  if (!categoryName) throw new HttpError(400, "Category is required.");
  const categorySlug = slugify(categoryName);
  const [existing] = await executor.select().from(serviceCategoriesTable).where(eq(serviceCategoriesTable.slug, categorySlug)).limit(1);
  if (existing) return existing.id;
  const [created] = await executor.insert(serviceCategoriesTable).values({ name: categoryName, slug: categorySlug }).returning({ id: serviceCategoriesTable.id });
  return created.id;
}

async function writeAudit(actor: SpaActor, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await db.insert(auditLogsTable).values({ actorId: actor.id, actorLabel: actor.label, action, entityType, entityId, metadata });
}

export async function listManageServices() {
  return db.select({
    id: servicesTable.id,
    name: servicesTable.name,
    slug: servicesTable.slug,
    category: serviceCategoriesTable.name,
    shortDescription: servicesTable.shortDescription,
    description: servicesTable.description,
    durationMinutes: servicesTable.durationMinutes,
    priceAmount: servicesTable.priceAmount,
    discountPercent: servicesTable.discountPercent,
    currency: servicesTable.currency,
    imageUrl: servicesTable.imageUrl,
    isFeatured: servicesTable.isFeatured,
    isActive: servicesTable.isActive,
  }).from(servicesTable).innerJoin(serviceCategoriesTable, eq(servicesTable.categoryId, serviceCategoriesTable.id)).orderBy(asc(serviceCategoriesTable.sortOrder), asc(servicesTable.name));
}

export async function createManagedService(input: ServiceInput, actor: SpaActor) {
  if ((input.discountPercent ?? 0) > 0 && actor.role !== "admin") {
    throw new HttpError(403, "Only an admin can apply service discounts.");
  }
  const categoryId = await categoryIdFor(input.category);
  const slug = slugify(input.name);
  if (!slug) throw new HttpError(400, "Service name is required.");
  const [created] = await db.insert(servicesTable).values({
    categoryId,
    name: input.name.trim(),
    slug,
    shortDescription: input.shortDescription.trim(),
    description: input.description.trim(),
    durationMinutes: input.durationMinutes,
    priceAmount: input.priceAmount,
    discountPercent: input.discountPercent ?? 0,
    currency: input.currency.trim().toUpperCase(),
    isFeatured: input.isFeatured ?? false,
    imageUrl: input.imageUrl?.trim() || null,
  }).returning({ id: servicesTable.id });
  await writeAudit(actor, "service.created", "service", created.id, { name: input.name });
  return created;
}

export async function updateManagedService(id: string, input: Partial<ServiceInput> & { isActive?: boolean }, actor: SpaActor) {
  if (input.discountPercent !== undefined && actor.role !== "admin") {
    throw new HttpError(403, "Only an admin can change service discounts.");
  }
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) { patch.name = input.name.trim(); patch.slug = slugify(input.name); }
  if (input.category !== undefined) patch.categoryId = await categoryIdFor(input.category);
  if (input.shortDescription !== undefined) patch.shortDescription = input.shortDescription.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.durationMinutes !== undefined) patch.durationMinutes = input.durationMinutes;
  if (input.priceAmount !== undefined) patch.priceAmount = input.priceAmount;
  if (input.discountPercent !== undefined) patch.discountPercent = input.discountPercent;
  if (input.currency !== undefined) patch.currency = input.currency.trim().toUpperCase();
  if (input.isFeatured !== undefined) patch.isFeatured = input.isFeatured;
  if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl?.trim() || null;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  const [updated] = await db.update(servicesTable).set(patch).where(eq(servicesTable.id, id)).returning({ id: servicesTable.id });
  if (!updated) throw new HttpError(404, "Service not found.");
  await writeAudit(actor, "service.updated", "service", id, { fields: Object.keys(patch) });
  return updated;
}

export async function listManageCustomers(search?: string, accountType: "all" | "guest" | "account" = "all") {
  const filters = [];
  if (search?.trim()) {
    const value = `%${search.trim()}%`;
    filters.push(or(
      ilike(customersTable.name, value),
      ilike(customersTable.email, value),
      ilike(customersTable.phone, value),
    ));
  }
  if (accountType === "guest") filters.push(isNull(customersTable.clerkUserId));
  if (accountType === "account") filters.push(isNotNull(customersTable.clerkUserId));

  return db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      email: customersTable.email,
      phone: customersTable.phone,
      hasAccount: isNotNull(customersTable.clerkUserId),
      createdAt: customersTable.createdAt,
      updatedAt: customersTable.updatedAt,
    })
    .from(customersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(customersTable.name));
}

export async function updateManagedCustomer(id: string, input: { name?: string; email?: string; phone?: string }, actor: SpaActor) {
  const patch = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== ""));
  if (!Object.keys(patch).length) throw new HttpError(400, "Provide at least one customer field.");
  const [updated] = await db.update(customersTable).set({ ...patch, updatedAt: new Date() }).where(eq(customersTable.id, id)).returning({ id: customersTable.id });
  if (!updated) throw new HttpError(404, "Customer not found.");
  await writeAudit(actor, "customer.updated", "customer", id, { fields: Object.keys(patch) });
  return updated;
}

export async function listManageStaff(actor?: SpaActor) {
  const profiles = await db.select({ id: staffProfilesTable.id, displayName: staffProfilesTable.displayName, bio: staffProfilesTable.bio, clerkUserId: staffProfilesTable.clerkUserId, isBookable: staffProfilesTable.isBookable, isActive: staffProfilesTable.isActive, createdAt: staffProfilesTable.createdAt, updatedAt: staffProfilesTable.updatedAt }).from(staffProfilesTable).orderBy(asc(staffProfilesTable.displayName));
  const staff = await Promise.all(profiles.map(async (profile) => {
    if (!profile.clerkUserId) return { ...profile, accountEmail: null, accountRole: null, accountPermissions: rolePermissions.user, accountDisabled: false };
    const user = await clerkClient.users.getUser(profile.clerkUserId);
    const accountRole = user.publicMetadata.role === "manager" || user.publicMetadata.role === "admin" ? user.publicMetadata.role : "user";
    const accountPermissions = getEffectiveSpaPermissions(accountRole, user.publicMetadata.permissions);
    return { ...profile, accountEmail: user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress ?? null, accountRole, accountPermissions, accountDisabled: user.publicMetadata.disabled === true };
  }));
  return actor?.role === "admin" ? staff : staff.filter((profile) => profile.accountRole === "user" || profile.accountRole === null);
}

export async function createManagedStaff(input: StaffInput, actor: SpaActor) {
  if (!input.displayName.trim()) throw new HttpError(400, "Staff name is required.");
  if (!input.accountEmail) throw new HttpError(400, "A staff account email is required.");
  if (input.role && input.role !== "user" && actor.role !== "admin") throw new HttpError(403, "Only an admin can create manager or admin accounts.");
  if (input.permissions && actor.role !== "admin") throw new HttpError(403, "Only an admin can change staff permissions.");
  const email = input.accountEmail.trim().toLowerCase();
  const matches = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
  const existingUser = matches.data.find((candidate) => candidate.emailAddresses.some((address) => address.emailAddress.toLowerCase() === email));
  if (existingUser) {
    if (actor.role !== "admin" && (existingUser.publicMetadata.role === "manager" || existingUser.publicMetadata.role === "admin")) {
      throw new HttpError(403, "Managers cannot manage manager or admin accounts.");
    }
    const [alreadyLinked] = await db.select({ id: staffProfilesTable.id }).from(staffProfilesTable).where(eq(staffProfilesTable.clerkUserId, existingUser.id)).limit(1);
    if (alreadyLinked) throw new HttpError(409, "This sign-in account is already linked to another staff profile.");
  } else if (!input.password) {
    throw new HttpError(400, "No account uses this email yet. Enter a temporary password of at least 15 characters to create one.");
  } else if (input.password.length < 15) {
    throw new HttpError(400, "Staff passwords must be at least 15 characters.");
  }

  const user = existingUser ?? await clerkClient.users.createUser({ emailAddress: [email], password: input.password!, firstName: input.displayName.trim(), publicMetadata: { role: input.role ?? "user", disabled: input.accountDisabled ?? false, ...(input.permissions ? { permissions: input.permissions } : {}) } });
  if (existingUser) {
    await clerkClient.users.updateUserMetadata(user.id, { publicMetadata: { ...user.publicMetadata, role: input.role ?? "user", ...(input.accountDisabled !== undefined ? { disabled: input.accountDisabled } : {}), ...(input.permissions ? { permissions: input.permissions } : {}) } });
    clearSpaAccessCache(user.id);
  }
  const createdByThisRequest = !existingUser;
  try {
    const [created] = await db.insert(staffProfilesTable).values({ clerkUserId: user.id, displayName: input.displayName.trim(), bio: input.bio?.trim() ?? "", isBookable: input.isBookable ?? true, isActive: input.isActive ?? true }).returning({ id: staffProfilesTable.id });
    await writeAudit(actor, "staff.account_created", "staff_profile", created.id, { clerkUserId: user.id, role: input.role ?? "user", ...(input.permissions ? { permissions: input.permissions } : {}) });
    return created;
  } catch (error) {
    if (createdByThisRequest) await clerkClient.users.deleteUser(user.id);
    throw error;
  }
}

export async function updateManagedStaff(id: string, input: Partial<StaffInput>, actor: SpaActor) {
  const [profile] = await db.select().from(staffProfilesTable).where(eq(staffProfilesTable.id, id)).limit(1);
  if (!profile) throw new HttpError(404, "Staff profile not found.");
  if (input.role && input.role !== "user" && actor.role !== "admin") throw new HttpError(403, "Only an admin can assign manager or admin roles.");
  if (input.permissions && actor.role !== "admin") throw new HttpError(403, "Only an admin can change staff permissions.");
  if (profile.clerkUserId && input.password && input.password.length < 15) throw new HttpError(400, "Staff passwords must be at least 15 characters.");
  let clerkUserId = profile.clerkUserId;
  if (actor.role !== "admin" && clerkUserId) {
    const targetUser = await clerkClient.users.getUser(clerkUserId);
    if (targetUser.publicMetadata.role === "manager" || targetUser.publicMetadata.role === "admin") {
      throw new HttpError(403, "Managers cannot manage manager or admin accounts.");
    }
  }
  const updateExistingPassword = Boolean(profile.clerkUserId && input.password);
  if (!clerkUserId && (input.role !== undefined || input.permissions !== undefined) && !input.accountEmail) throw new HttpError(400, "Add the sign-in email before assigning a role or permissions.");
  if (!clerkUserId && input.accountEmail) {
    const email = input.accountEmail.trim().toLowerCase();
    const matches = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
    const existingUser = matches.data.find((candidate) => candidate.emailAddresses.some((address) => address.emailAddress.toLowerCase() === email));
    if (existingUser) {
      if (actor.role !== "admin" && (existingUser.publicMetadata.role === "manager" || existingUser.publicMetadata.role === "admin")) {
        throw new HttpError(403, "Managers cannot manage manager or admin accounts.");
      }
      const [alreadyLinked] = await db.select({ id: staffProfilesTable.id }).from(staffProfilesTable).where(eq(staffProfilesTable.clerkUserId, existingUser.id)).limit(1);
      if (alreadyLinked) throw new HttpError(409, "This sign-in account is already linked to another staff profile.");
      clerkUserId = existingUser.id;
    } else {
      if (!input.password) throw new HttpError(400, "No account uses this email yet. Enter a temporary password of at least 15 characters to create one.");
      if (input.password.length < 15) throw new HttpError(400, "Staff passwords must be at least 15 characters.");
      const createdUser = await clerkClient.users.createUser({ emailAddress: [email], password: input.password, firstName: input.displayName?.trim() || profile.displayName, publicMetadata: { role: input.role ?? "user", disabled: input.accountDisabled ?? false, ...(input.permissions ? { permissions: input.permissions } : {}) } });
      clerkUserId = createdUser.id;
    }
  }
  if (clerkUserId) {
    const user = await clerkClient.users.getUser(clerkUserId);
    if (updateExistingPassword && input.password) await clerkClient.users.updateUser(user.id, { password: input.password, signOutOfOtherSessions: true });
    if (input.role !== undefined || input.accountDisabled !== undefined || input.permissions !== undefined) {
      await clerkClient.users.updateUserMetadata(user.id, { publicMetadata: { ...user.publicMetadata, ...(input.role !== undefined ? { role: input.role } : {}), ...(input.accountDisabled !== undefined ? { disabled: input.accountDisabled } : {}), ...(input.permissions !== undefined ? { permissions: input.permissions } : {}) } });
      clearSpaAccessCache(user.id);
    }
  }
  const patch = Object.fromEntries(Object.entries(input).filter(([key, value]) => value !== undefined && !["accountEmail", "password", "role", "accountDisabled"].includes(key)));
  if (clerkUserId && clerkUserId !== profile.clerkUserId) patch.clerkUserId = clerkUserId;
  if (typeof patch.displayName === "string") patch.displayName = patch.displayName.trim();
  if (typeof patch.bio === "string") patch.bio = patch.bio.trim();
  const [updated] = await db.update(staffProfilesTable).set({ ...patch, updatedAt: new Date() }).where(eq(staffProfilesTable.id, id)).returning({ id: staffProfilesTable.id });
  if (!updated) throw new HttpError(404, "Staff profile not found.");
  await writeAudit(actor, "staff.account_updated", "staff_profile", id, { fields: [...Object.keys(patch), ...(input.password ? ["password"] : []), ...(input.role ? ["role"] : []), ...(input.permissions !== undefined ? ["permissions"] : []), ...(input.accountDisabled !== undefined ? ["accountDisabled"] : [])] });
  return updated;
}
