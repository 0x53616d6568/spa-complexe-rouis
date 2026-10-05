import { Router, type IRouter } from "express";
import { ListAuditLogsResponse } from "@workspace/api-zod";
import { requireSpaPermission } from "../modules/auth/authorization";
import { listRecentAuditEvents } from "../modules/audit/audit.service";
import { sendRouteError } from "../modules/shared/http-error";

const router: IRouter = Router();

router.get(
  "/admin/audit-logs",
  requireSpaPermission("view_audit_logs"),
  async (request, response) => {
    try {
      response.json(
        ListAuditLogsResponse.parse(await listRecentAuditEvents()),
      );
    } catch (error) {
      sendRouteError(request, response, error);
    }
  },
);

export default router;