import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { cashierSession, deviceCredential, member, sale } from "@shopper/db-pg";
import { acceptSale } from "@shopper/core/sales";
import { databases, deviceId, recordSale } from "../../support/till/server";

test("a sale is refused once its device credential, cashier membership or session is gone, and accepted when all hold", async () => {
  const created = await recordSale();
  const { db, context } = databases();
  const principal = {
    orgId: context.orgId,
    deviceId,
    branchId: created.event.sale.branchId,
    storeId: created.event.sale.storeId,
  };
  const accept = (proof = created.proof) => acceptSale(db, principal, created.event, proof);
  const refused = async () => {
    await expect(accept()).rejects.toMatchObject({ code: "INVALID_SESSION" });
    expect(await db.select().from(sale).where(eq(sale.id, created.event.sale.id))).toEqual([]);
  };
  const credential = and(
    eq(deviceCredential.orgId, context.orgId),
    eq(deviceCredential.deviceId, deviceId),
  );
  await db.update(deviceCredential).set({ revokedAt: new Date() }).where(credential);
  await refused();
  await db.update(deviceCredential).set({ revokedAt: null }).where(credential);

  const membership = and(
    eq(member.orgId, context.orgId),
    eq(member.userId, created.event.sale.cashierId),
  );
  const [cashier] = await db.select().from(member).where(membership);
  await db.delete(member).where(membership);
  await refused();
  await db.insert(member).values(cashier!);

  const session = and(
    eq(cashierSession.orgId, context.orgId),
    eq(cashierSession.id, created.event.sale.sessionId),
  );
  await db.update(cashierSession).set({ revokedAt: new Date() }).where(session);
  await refused();
  await db.update(cashierSession).set({ revokedAt: null }).where(session);

  // Deactivation cuts the session instead of revoking it: a sale made before the cut keeps its authority,
  // one after it does not, even though the member is deactivated by the time either uploads.
  await db.update(member).set({ deactivatedAt: new Date() }).where(membership);
  await db
    .update(cashierSession)
    .set({ expiresAt: new Date("2025-12-31T23:00:00Z") })
    .where(session);
  await refused();
  await db
    .update(cashierSession)
    .set({ expiresAt: new Date("2025-12-31T23:31:00Z") })
    .where(session);

  await expect(accept("not-the-session-proof")).rejects.toMatchObject({ code: "INVALID_SESSION" });
  await expect(accept()).resolves.toMatchObject({ localId: created.event.sale.localId });
});
