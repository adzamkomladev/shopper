import { expect, test } from "vite-plus/test";
import { eq, sql } from "drizzle-orm";
import { auditLog, sale, saleLine, saleTender, stockMovement } from "@shopper/db-pg";
import { acceptSale } from "@shopper/core/sales";
import { databases, deviceId, recordSale } from "../../../support/till/server";

test("a failed completion audit rolls back PostgreSQL sale, tender, stock and receipt together", async () => {
  const created = await recordSale();
  const snapshot = created.event.sale;
  const { db, context } = databases();
  await db.execute(sql`CREATE FUNCTION reject_sale_accept_audit() RETURNS trigger AS $$
    BEGIN IF NEW.command = 'sale.accept' THEN RAISE EXCEPTION 'injected sale audit failure'; END IF;
    RETURN NEW; END; $$ LANGUAGE plpgsql`);
  await db.execute(sql`CREATE TRIGGER reject_sale_accept_audit BEFORE INSERT ON audit_log
    FOR EACH ROW EXECUTE FUNCTION reject_sale_accept_audit()`);
  try {
    await expect(
      acceptSale(
        db,
        { orgId: context.orgId, deviceId, branchId: snapshot.branchId, storeId: snapshot.storeId },
        created.event,
        created.proof,
      ),
    ).rejects.toThrow();
    expect(await db.select().from(sale).where(eq(sale.id, snapshot.id))).toEqual([]);
    expect(await db.select().from(saleLine).where(eq(saleLine.saleId, snapshot.id))).toEqual([]);
    expect(await db.select().from(saleTender).where(eq(saleTender.saleId, snapshot.id))).toEqual(
      [],
    );
    expect(
      await db.select().from(stockMovement).where(eq(stockMovement.saleId, snapshot.id)),
    ).toEqual([]);
    expect(await db.select().from(auditLog).where(eq(auditLog.entityId, snapshot.id))).toEqual([]);
  } finally {
    await db.execute(sql`DROP TRIGGER reject_sale_accept_audit ON audit_log`);
    await db.execute(sql`DROP FUNCTION reject_sale_accept_audit()`);
  }
});
