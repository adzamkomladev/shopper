import { desc, eq } from "drizzle-orm";
import { auditLog, user, workflowRun, type ShopperDatabase } from "@shopper/db-pg";

/** The shop's workflows as PostgreSQL records them, the most recently moved first. */
export function tenantWorkflows(db: ShopperDatabase, orgId: string) {
  return db
    .select({
      instanceId: workflowRun.instanceId,
      type: workflowRun.type,
      status: workflowRun.status,
      currentStep: workflowRun.currentStep,
      createdAt: workflowRun.createdAt,
      updatedAt: workflowRun.updatedAt,
    })
    .from(workflowRun)
    .where(eq(workflowRun.orgId, orgId))
    .orderBy(desc(workflowRun.updatedAt))
    .limit(50)
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    );
}

/**
 * The newest audit rows: what was done, to what, by whom and why. Payloads stay out; the shop's own audit viewer
 * shows them to the people allowed to read them.
 */
export function tenantActivity(db: ShopperDatabase, orgId: string) {
  return db
    .select({
      id: auditLog.id,
      command: auditLog.command,
      entity: auditLog.entity,
      actor: user.name,
      role: auditLog.role,
      reason: auditLog.reason,
      at: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .where(eq(auditLog.orgId, orgId))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(50)
    .then((rows) => rows.map((row) => ({ ...row, at: row.at.toISOString() })));
}
