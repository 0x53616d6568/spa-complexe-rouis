import { desc, like } from "drizzle-orm";
import { ListAuditLogsResponse, type AuditEvent } from "@workspace/api-zod";
import { auditLogsTable, db } from "@workspace/db";

export async function listRecentAuditEvents(): Promise<AuditEvent[]> {
  const rows = await db
    .select({
      id: auditLogsTable.id,
      actorLabel: auditLogsTable.actorLabel,
      action: auditLogsTable.action,
      entityType: auditLogsTable.entityType,
      entityId: auditLogsTable.entityId,
      createdAt: auditLogsTable.createdAt,
    })
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(100);

  return ListAuditLogsResponse.parse(rows);
}

export async function listRecentBusinessAuditEvents(): Promise<AuditEvent[]> {
  const rows = await db
    .select({
      id: auditLogsTable.id,
      actorLabel: auditLogsTable.actorLabel,
      action: auditLogsTable.action,
      entityType: auditLogsTable.entityType,
      entityId: auditLogsTable.entityId,
      createdAt: auditLogsTable.createdAt,
    })
    .from(auditLogsTable)
    .where(like(auditLogsTable.action, "booking.%"))
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(100);

  return ListAuditLogsResponse.parse(rows);
}
