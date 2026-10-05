import assert from "node:assert/strict";
import test from "node:test";
import {
  getEffectiveSpaPermissions,
  rolePermissions,
  spaPermissions,
} from "./authorization";

test("user permissions stay within customer account and booking capabilities", () => {
  assert.deepEqual(rolePermissions.user, [
    "browse_public_services",
    "create_own_booking",
    "view_own_profile",
    "view_own_booking_history",
    "cancel_own_booking",
    "manage_own_customer_record",
    "request_account_deletion",
  ]);
});

test("manager receives operational access and limited platform/audit access", () => {
  const permissions = getEffectiveSpaPermissions("manager");

  for (const permission of [
    "view_all_bookings",
    "create_edit_services",
    "manage_staff_schedules",
    "manage_customer_records",
    "view_operational_reports",
    "view_platform_settings",
    "view_business_audit_logs",
  ] as const) {
    assert.ok(permissions.includes(permission), `manager should have ${permission}`);
  }

  for (const permission of [
    "manage_managers_admins",
    "configure_roles_permissions",
    "change_platform_settings",
    "view_audit_logs",
    "delete_disable_accounts",
  ] as const) {
    assert.ok(!permissions.includes(permission), `manager should not have ${permission}`);
  }
});

test("custom manager permissions cannot grant admin-only capabilities", () => {
  const permissions = getEffectiveSpaPermissions("manager", spaPermissions);

  assert.ok(permissions.includes("view_business_audit_logs"));
  assert.ok(permissions.includes("view_platform_settings"));
  assert.ok(!permissions.includes("manage_managers_admins"));
  assert.ok(!permissions.includes("configure_roles_permissions"));
  assert.ok(!permissions.includes("change_platform_settings"));
  assert.ok(!permissions.includes("view_audit_logs"));
  assert.ok(!permissions.includes("delete_disable_accounts"));
});

test("legacy manager permissions are reduced to business audit and settings read access", () => {
  const permissions = getEffectiveSpaPermissions("manager", [
    "view_audit_logs",
    "change_platform_settings",
  ]);

  assert.deepEqual(permissions, [
    "view_business_audit_logs",
    "view_platform_settings",
  ]);
});

test("admin retains the complete permission set", () => {
  assert.deepEqual(
    getEffectiveSpaPermissions("admin").sort(),
    [...spaPermissions].sort(),
  );
});
