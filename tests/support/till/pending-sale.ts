import { seedAuthRoles } from "@shopper/auth";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import type { CommandContext } from "@shopper/audit";
import type { AcceptedSaleFixture } from "@shopper/conformance";
import { createSaleEvent } from "./sequencing/event";
import { seedPendingSale } from "./sequencing/seed";

type WithDatabase = <T>(
  run: (database: import("@shopper/db-pg").ShopperDatabase) => Promise<T>,
) => Promise<T>;

const failFunction = "conformance_fail_sale_assignment_audit";
const failTrigger = "conformance_fail_sale_assignment_audit";

export async function provisionPendingSale(
  db: import("@shopper/db-pg").ShopperDatabase,
  context: CommandContext,
  storeId: string,
  otherOrgId: string,
  appVersion: string,
  withDatabase: WithDatabase = (run) => run(db),
): Promise<AcceptedSaleFixture> {
  const sale = await createSaleEvent(appVersion, context.orgId, storeId);
  await seedAuthRoles(db, context, undefined);
  await seedPendingSale(db, context, sale);
  return {
    orgId: context.orgId,
    otherOrgId,
    storeId,
    otherStoreId: sale.otherStoreId,
    deviceId: sale.deviceId,
    otherDeviceId: sale.otherDeviceId,
    localId: sale.localId,
    missingLocalId: v7(),
    inspect: () =>
      withDatabase(async (db) => {
        const [saved] = await db
          .select()
          .from(schema.sale)
          .where(eq(schema.sale.localId, sale.localId));
        const assignments = await db
          .select()
          .from(schema.auditLog)
          .where(
            and(
              eq(schema.auditLog.command, "sale.assign-sequence"),
              eq(schema.auditLog.entityId, sale.localId),
            ),
          );
        return { sequence: saved?.storeSequence ?? null, assignmentAudits: assignments.length };
      }),
    failAssignmentAudit: () => failAssignmentAudit(withDatabase),
  };
}

async function failAssignmentAudit(withDatabase: WithDatabase) {
  await withDatabase(async (db) => {
    await db.execute(
      sql.raw(`
    CREATE FUNCTION ${failFunction}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.command = 'sale.assign-sequence' THEN
        RAISE EXCEPTION 'injected assignment audit failure';
      END IF;
      RETURN NEW;
    END;
    $$
  `),
    );
    await db.execute(
      sql.raw(`
    CREATE TRIGGER ${failTrigger} BEFORE INSERT ON audit_log
    FOR EACH ROW EXECUTE FUNCTION ${failFunction}()
  `),
    );
  });
  return () =>
    withDatabase(async (db) => {
      await db.execute(sql.raw(`DROP TRIGGER ${failTrigger} ON audit_log`));
      await db.execute(sql.raw(`DROP FUNCTION ${failFunction}()`));
    });
}
