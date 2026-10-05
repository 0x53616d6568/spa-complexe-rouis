import { Router, type IRouter, type Response } from "express";
import { z } from "@workspace/api-zod";
import {
  AssignBookingStaffBody,
  AssignBookingStaffParams,
  GetManagerDashboardResponse,
  ListManagerBookingsQueryParams,
  ListManagerStaffResponse,
  UpdateBookingStatusBody,
  UpdateBookingStatusParams,
} from "@workspace/api-zod";
import { requireSpaPermission, spaPermissions } from "../modules/auth/authorization";
import { listRecentBusinessAuditEvents } from "../modules/audit/audit.service";
import {
  assignBookingStaff,
  getManagerDashboard,
  listAssignableStaff,
  listManagerBookings,
  updateBookingStatus,
  type SpaActor,
} from "../modules/staff/manager.service";
import {
  createManagedStaff,
  createManagedService,
  listManageCustomers,
  listManageServices,
  listManageStaff,
  updateManagedCustomer,
  updateManagedService,
  updateManagedStaff,
} from "../modules/staff/management.service";
import { HttpError, sendRouteError } from "../modules/shared/http-error";
import { serviceBody, updateServiceBody } from "../modules/staff/service-validation";

const router: IRouter = Router();
const actor = (response: Response) => response.locals.actor as SpaActor;
const routeId = (value: string | string[]) => {
  if (typeof value !== "string") throw new HttpError(400, "Invalid resource ID.");
  return value;
};
const staffBody = z.object({ displayName: z.string().min(2).max(120), bio: z.string().max(2000).optional(), isBookable: z.boolean().optional(), isActive: z.boolean().optional(), accountEmail: z.string().email().max(254).optional(), password: z.string().max(128).optional(), role: z.enum(["user", "manager", "admin"]).optional(), permissions: z.array(z.enum(spaPermissions)).optional(), accountDisabled: z.boolean().optional() });
const customerBody = z.object({ name: z.string().min(2).max(120).optional(), email: z.string().email().max(254).optional(), phone: z.string().min(7).max(40).optional() });

router.get("/manager/dashboard", requireSpaPermission("view_operational_reports"), async (request, response) => {
  try {
    const result = GetManagerDashboardResponse.parse(
      await getManagerDashboard(),
    );
    response.json(result);
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.get("/manager/bookings", requireSpaPermission("view_all_bookings"), async (request, response) => {
  try {
    const rawDate =
      typeof request.query.date === "string" ? request.query.date : undefined;
    if (
      rawDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) ||
        Number.isNaN(new Date(`${rawDate}T00:00:00.000Z`).getTime()))
    ) {
      throw new HttpError(400, "Date must use YYYY-MM-DD format.");
    }
    const parsed = ListManagerBookingsQueryParams.safeParse({
      date: rawDate
        ? new Date(`${rawDate}T00:00:00.000Z`)
        : undefined,
    });
    if (!parsed.success) throw new HttpError(400, "Invalid booking date.");
    const date = parsed.data.date?.toISOString().slice(0, 10);
    response.json(await listManagerBookings(date));
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.get("/manager/staff", requireSpaPermission("manage_staff_schedules"), async (request, response) => {
  try {
    response.json(ListManagerStaffResponse.parse(await listAssignableStaff()));
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.patch("/manager/bookings/:id/staff", requireSpaPermission("manage_staff_schedules"), async (request, response) => {
  try {
    const params = AssignBookingStaffParams.safeParse(request.params);
    const body = AssignBookingStaffBody.safeParse(request.body);
    if (!params.success || !body.success) {
      throw new HttpError(400, "Provide a valid booking ID and therapist.");
    }
    response.json(
      await assignBookingStaff(
        params.data.id,
        body.data.staffId,
        response.locals.actor as SpaActor,
      ),
    );
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.patch("/manager/bookings/:id/status", requireSpaPermission("view_all_bookings"), async (request, response) => {
  try {
    const params = UpdateBookingStatusParams.safeParse(request.params);
    const body = UpdateBookingStatusBody.safeParse(request.body);
    if (!params.success || !body.success) {
      throw new HttpError(400, "Provide a valid booking status update.");
    }
    response.json(
      await updateBookingStatus(
        params.data.id,
        body.data.status,
        body.data.reason,
        response.locals.actor as SpaActor,
      ),
    );
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.get("/manager/manage-services", requireSpaPermission("create_edit_services"), async (request, response) => {
  try { response.json(await listManageServices()); } catch (error) { sendRouteError(request, response, error); }
});

router.post("/manager/services", requireSpaPermission("create_edit_services"), async (request, response) => {
  try {
    const parsed = serviceBody.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "Provide valid service details.");
    const currentActor = actor(response);
    if ((parsed.data.discountPercent ?? 0) > 0 && currentActor.role !== "admin") throw new HttpError(403, "Only an admin can apply service discounts.");
    response.status(201).json(await createManagedService(parsed.data, currentActor));
  } catch (error) { sendRouteError(request, response, error); }
});

router.patch("/manager/services/:id", requireSpaPermission("create_edit_services"), async (request, response) => {
  try {
    const parsed = updateServiceBody.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "Provide valid service details.");
    const currentActor = actor(response);
    if (parsed.data.discountPercent !== undefined && currentActor.role !== "admin") throw new HttpError(403, "Only an admin can change service discounts.");
    response.json(await updateManagedService(routeId(request.params.id), parsed.data, currentActor));
  } catch (error) { sendRouteError(request, response, error); }
});

router.delete("/manager/services/:id", requireSpaPermission("create_edit_services"), async (request, response) => {
  try { response.json(await updateManagedService(routeId(request.params.id), { isActive: false }, actor(response))); } catch (error) { sendRouteError(request, response, error); }
});

router.get("/manager/customers", requireSpaPermission("manage_customer_records"), async (request, response) => {
  try {
    const rawAccountType = typeof request.query.accountType === "string" ? request.query.accountType : "all";
    if (!(["all", "guest", "account"] as const).includes(rawAccountType as "all" | "guest" | "account")) {
      throw new HttpError(400, "Choose all customers, guests, or account customers.");
    }
    response.json(await listManageCustomers(
      typeof request.query.search === "string" ? request.query.search : undefined,
      rawAccountType as "all" | "guest" | "account",
    ));
  } catch (error) { sendRouteError(request, response, error); }
});

router.patch("/manager/customers/:id", requireSpaPermission("manage_customer_records"), async (request, response) => {
  try {
    const parsed = customerBody.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, "Provide valid customer details.");
    response.json(await updateManagedCustomer(routeId(request.params.id), parsed.data, actor(response)));
  } catch (error) { sendRouteError(request, response, error); }
});

router.get("/manager/directory", requireSpaPermission("manage_staff_schedules"), async (request, response) => {
  try { response.json(await listManageStaff(actor(response))); } catch (error) { sendRouteError(request, response, error); }
});

router.post("/manager/directory", requireSpaPermission("manage_staff_schedules"), async (request, response) => {
  try {
    const parsed = staffBody.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Provide valid staff details.");
    response.status(201).json(await createManagedStaff(parsed.data, actor(response)));
  } catch (error) { sendRouteError(request, response, error); }
});

router.patch("/manager/directory/:id", requireSpaPermission("manage_staff_schedules"), async (request, response) => {
  try {
    const parsed = staffBody.partial().safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Provide valid staff details.");
    response.json(await updateManagedStaff(routeId(request.params.id), parsed.data, actor(response)));
  } catch (error) { sendRouteError(request, response, error); }
});

router.delete("/manager/directory/:id", requireSpaPermission("manage_staff_schedules"), async (request, response) => {
  try { response.json(await updateManagedStaff(routeId(request.params.id), { isActive: false }, actor(response))); } catch (error) { sendRouteError(request, response, error); }
});

router.get("/manager/audit-logs", requireSpaPermission("view_business_audit_logs"), async (request, response) => {
  try { response.json(await listRecentBusinessAuditEvents()); } catch (error) { sendRouteError(request, response, error); }
});

export default router;
