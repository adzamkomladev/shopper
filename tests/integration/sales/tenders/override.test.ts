// A sale line may carry override { listPrice, reason, approverId } (sale event v4). The server accepts the changed
// unit price only when listPrice is the price row and the cashier session or the approver holds sale.price_override.
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import {
  auditLog,
  barcodeMapping,
  cashierSession,
  member,
  permission,
  productBarcode,
  rolePermission,
  sale,
} from "@shopper/db-pg";
import { memberWithPin } from "../../../support/sync/members";
import { databases, deviceId, principal, recordSale } from "../../../support/till/server";
import { weightLabel } from "../../../support/till/drafts";
import { ids } from "../../../support/till/sales";
import {
  accept,
  listPrice,
  overridden,
  reason,
  type Created,
} from "../../../support/sales/override";

test("an overridden line is accepted when the approver holds sale.price_override, and the audit names them", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Esi Manager", "admin", "2468");
  const event = overridden(created, 9_000, { listPrice: listPrice(created), reason, approverId });
  await accept(created, event);
  const { db } = databases();
  const [audit] = await db.select().from(auditLog).where(eq(auditLog.entityId, event.sale.id));
  expect(audit).toMatchObject({ command: "sale.accept", approverId });
  expect(audit?.actorId).toBe(event.sale.cashierId);
});

test("an overridden line is rejected when the approver lacks the grant", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Kojo Cashier", "cashier", "1111");
  const event = overridden(created, 9_000, { listPrice: listPrice(created), reason, approverId });
  await expect(accept(created, event)).rejects.toMatchObject({ code: "INVALID_SESSION" });
  const { db } = databases();
  expect(await db.select().from(sale).where(eq(sale.localId, event.sale.localId))).toEqual([]);
});

test("an approver deactivated before the sale no longer authorises it; one deactivated after still does", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Abena Manager", "admin", "2468");
  const event = overridden(created, 9_000, { listPrice: listPrice(created), reason, approverId });
  const { db } = databases();
  const approver = eq(member.userId, approverId);
  await db
    .update(member)
    .set({ deactivatedAt: new Date("2025-12-31T23:00:00Z") })
    .where(approver);
  await expect(accept(created, event)).rejects.toMatchObject({ code: "INVALID_SESSION" });
  await db
    .update(member)
    .set({ deactivatedAt: new Date("2025-12-31T23:45:00Z") })
    .where(approver);
  await expect(accept(created, event)).resolves.toMatchObject({ localId: event.sale.localId });
});

test("an override with no approver needs the cashier session to hold the grant", async () => {
  const created = await recordSale();
  const event = overridden(created, 9_000, {
    listPrice: listPrice(created),
    reason,
    approverId: null,
  });
  await expect(accept(created, event)).rejects.toMatchObject({ code: "INVALID_SESSION" });
});

test("an override must quote the real list price and really change the unit price", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Ama Manager", "admin", "2468");
  const wrongList = overridden(created, 9_000, { listPrice: 11_000, reason, approverId });
  await expect(accept(created, wrongList)).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
  const unchanged = overridden(created, listPrice(created), {
    listPrice: listPrice(created),
    reason,
    approverId,
  });
  await expect(accept(created, unchanged)).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
});

test("a changed price with no override is still rejected", async () => {
  const created = await recordSale();
  await expect(accept(created, overridden(created, 9_000, null))).rejects.toMatchObject({
    code: "INVALID_REFERENCE",
  });
});

const auditOf = async (saleId: string) =>
  (await databases().db.select().from(auditLog).where(eq(auditLog.entityId, saleId)))[0];

/** The recorded cashier's session and role now hold sale.price_override. */
async function grantCashier(created: Created) {
  const { db, context } = databases();
  const [granted] = await db
    .select({ id: permission.id })
    .from(permission)
    .where(and(eq(permission.orgId, context.orgId), eq(permission.code, "sale.price_override")));
  await db
    .insert(rolePermission)
    .values({ orgId: context.orgId, roleId: principal.roleId, permissionId: granted!.id })
    .onConflictDoNothing();
  await db
    .update(cashierSession)
    .set({ permissions: ["sale.create", "sale.price_override"] })
    .where(eq(cashierSession.id, created.sessionId));
}

test("every overridden line is mapped to its approver in the audit payload", async () => {
  const created = await recordSale({ lineCount: 2 });
  const approverId = await memberWithPin("Yaw Manager", "admin", "2468");
  const other = await memberWithPin("Kwesi Manager", "admin", "2468");
  const first = { listPrice: listPrice(created), reason, approverId };
  const second = { listPrice: listPrice(created), reason, approverId: other };
  const same = overridden(created, 9_000, first, {}, { unitPrice: 8_000, override: first });
  await accept(created, same);
  const lines = same.sale.lines;
  expect((await auditOf(same.sale.id))?.payload).toMatchObject({
    overrides: [
      { lineId: lines[0]!.id, approverId },
      { lineId: lines[1]!.id, approverId },
    ],
  });
  expect((await auditOf(same.sale.id))?.approverId).toBe(approverId);
  const split = await recordSale({ lineCount: 2 });
  const two = overridden(split, 9_000, first, {}, { unitPrice: 8_000, override: second });
  await accept(split, two);
  const audit = await auditOf(two.sale.id);
  expect(audit?.approverId).toBeNull();
  expect(audit?.payload).toMatchObject({
    overrides: [
      { lineId: two.sale.lines[0]!.id, approverId },
      { lineId: two.sale.lines[1]!.id, approverId: other },
    ],
  });
});

test("a cashier who holds the grant overrides alone: accepted, mapped with a null approver, no audit approver", async () => {
  const created = await recordSale();
  await grantCashier(created);
  const event = overridden(created, 9_000, {
    listPrice: listPrice(created),
    reason,
    approverId: null,
  });
  await accept(created, event);
  const audit = await auditOf(event.sale.id);
  expect(audit?.approverId).toBeNull();
  expect(audit?.payload).toMatchObject({
    overrides: [{ lineId: event.sale.lines[0]!.id, approverId: null }],
  });
});

test("a self-authorised line beside an approved one leaves the audit approver empty", async () => {
  const created = await recordSale({ lineCount: 2 });
  await grantCashier(created);
  const approverId = await memberWithPin("Abena Manager", "admin", "2468");
  const event = overridden(
    created,
    9_000,
    { listPrice: listPrice(created), reason, approverId },
    {},
    { unitPrice: 8_000, override: { listPrice: listPrice(created), reason, approverId: null } },
  );
  await accept(created, event);
  const audit = await auditOf(event.sale.id);
  expect(audit?.approverId).toBeNull();
  expect(audit?.payload).toMatchObject({
    overrides: [
      { lineId: event.sale.lines[0]!.id, approverId },
      { lineId: event.sale.lines[1]!.id, approverId: null },
    ],
  });
});

test("a price-labelled line cannot carry an override", async () => {
  const created = await recordSale();
  const approverId = await memberWithPin("Efua Manager", "admin", "2468");
  const event = overridden(
    created,
    9_000,
    { listPrice: listPrice(created), reason, approverId },
    { label: { kind: "price", code: "2200123001006", originalPriceId: ids.branchPrice } },
  );
  await expect(accept(created, event)).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
});

test("a weight-labelled line may carry an override", async () => {
  const created = await recordSale();
  const { db, context } = databases();
  const approverId = await memberWithPin("Kofi Manager", "admin", "2468");
  await db.insert(barcodeMapping).values({
    orgId: context.orgId,
    prefix: 21,
    kind: "weight",
    productStart: 2,
    productLength: 5,
    valueStart: 7,
    valueLength: 5,
    decimals: 0,
    unit: "g",
  });
  await db
    .insert(productBarcode)
    .values({ orgId: context.orgId, productId: ids.product, code: "00123" });
  const event = overridden(
    created,
    9_000,
    { listPrice: listPrice(created), reason, approverId },
    { label: { kind: "weight", code: weightLabel } },
  );
  await accept(created, event);
  expect(await auditOf(event.sale.id)).toMatchObject({ command: "sale.accept", approverId });
});
