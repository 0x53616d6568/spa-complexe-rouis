import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export type SpaRole = "user" | "manager" | "admin";
export const spaPermissions = [
  "browse_public_services",
  "create_own_booking",
  "view_own_profile",
  "view_own_booking_history",
  "cancel_own_booking",
  "manage_own_customer_record",
  "request_account_deletion",
  "view_all_bookings",
  "create_edit_services",
  "manage_staff_schedules",
  "manage_customer_records",
  "view_operational_reports",
  "view_platform_settings",
  "view_business_audit_logs",
  "manage_managers_admins",
  "change_platform_settings",
  "view_audit_logs",
  "delete_disable_accounts",
  "configure_roles_permissions",
] as const;
export type SpaPermission = (typeof spaPermissions)[number];

const userPermissions: readonly SpaPermission[] = [
  "browse_public_services",
  "create_own_booking",
  "view_own_profile",
  "view_own_booking_history",
  "cancel_own_booking",
  "manage_own_customer_record",
  "request_account_deletion",
];

export const rolePermissions: Record<SpaRole, readonly SpaPermission[]> = {
  user: userPermissions,
  manager: [
    ...userPermissions,
    "view_all_bookings",
    "create_edit_services",
    "manage_staff_schedules",
    "manage_customer_records",
    "view_operational_reports",
    "view_platform_settings",
    "view_business_audit_logs",
  ],
  admin: [
    ...userPermissions,
    "view_all_bookings",
    "create_edit_services",
    "manage_staff_schedules",
    "manage_customer_records",
    "view_operational_reports",
    "manage_managers_admins",
    "change_platform_settings",
    "view_platform_settings",
    "view_business_audit_logs",
    "view_audit_logs",
    "delete_disable_accounts",
    "configure_roles_permissions",
  ],
};

const roleCache = new Map<
  string,
  { role: SpaRole; permissions: readonly SpaPermission[]; expiresAt: number }
>();
const roleCacheTtlMs = 30_000;

export function clearSpaAccessCache(userId: string) {
  roleCache.delete(userId);
}

export function getEffectiveSpaPermissions(role: SpaRole, customPermissions?: unknown): SpaPermission[] {
  let permissions = Array.isArray(customPermissions)
    ? customPermissions.filter((permission): permission is SpaPermission => spaPermissions.includes(permission as SpaPermission))
    : [...rolePermissions[role]];
  if (role === "manager") {
    if (permissions.includes("view_audit_logs") && !permissions.includes("view_business_audit_logs")) permissions.push("view_business_audit_logs");
    if (permissions.includes("change_platform_settings") && !permissions.includes("view_platform_settings")) permissions.push("view_platform_settings");
    permissions = permissions.filter((permission) => ![
      "manage_managers_admins",
      "configure_roles_permissions",
      "change_platform_settings",
      "view_audit_logs",
      "delete_disable_accounts",
    ].includes(permission));
  }
  return permissions;
}

export async function getSpaAccess(userId: string) {
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { role: cached.role, permissions: cached.permissions };
  }

  const user = await clerkClient.users.getUser(userId);
  if (user.publicMetadata.disabled === true) {
    const permissions = rolePermissions.user;
    roleCache.set(userId, { role: "user", permissions, expiresAt: Date.now() + roleCacheTtlMs });
    return { role: "user" as const, permissions };
  }
  const value = user.publicMetadata.role;
  const role: SpaRole = value === "manager" || value === "admin" ? value : "user";
  const customPermissions = user.publicMetadata.permissions;
  const permissions = getEffectiveSpaPermissions(role, customPermissions);
  roleCache.set(userId, { role, permissions, expiresAt: Date.now() + roleCacheTtlMs });
  return { role, permissions };
}

export const requireSpaPermission =
  (...requiredPermissions: SpaPermission[]): RequestHandler =>
  async (request, response, next) => {
    const auth = getAuth(request);
    if (!auth.userId) {
      response.status(401).json({ error: "Sign in to access spa operations." });
      return;
    }

    let access: Awaited<ReturnType<typeof getSpaAccess>>;
    try {
      access = await getSpaAccess(auth.userId);
    } catch (error) {
      request.log?.error({ error }, "Could not verify the Clerk user role");
      response.status(503).json({
        error: "Access could not be verified. Please try again shortly.",
      });
      return;
    }

    if (!requiredPermissions.every((permission) => access.permissions.includes(permission))) {
      response.status(403).json({ error: "You do not have access to this area." });
      return;
    }

    response.locals.actor = {
      id: auth.userId,
      role: access.role,
      permissions: access.permissions,
      label: access.role === "admin" ? "Spa admin" : "Spa manager",
    };
    next();
  };
