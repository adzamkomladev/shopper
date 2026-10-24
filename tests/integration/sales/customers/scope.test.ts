// The customer snapshot on a v5 sale is untrusted: an id outside the org is refused, and a known id is never overwritten by it.
import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { sale } from "@shopper/db-pg";
import { acceptSale } from "@shopper/core/sales";
import { addCustomer } from "../../../support/customers/seed";
import { serverCustomer } from "../../../support/customers/till";
import { ids } from "../../../support/till/sales";
import { databases, deviceId, recordSale } from "../../../support/till/server";

const snapshot = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: "Snapshot Name",
  phone: "0240000077",
  kind: "individual",
  businessName: null,
  tin: null,
  ...over,
});

async function accept(customer: ReturnType<typeof snapshot>) {
  const created = await recordSale();
  const event = {
    ...structuredClone(created.event),
    v: 5,
    sale: { ...created.event.sale, customer },
  };
  const { db, context } = databases();
  const principal = {
    orgId: context.orgId,
    deviceId,
    branchId: event.sale.branchId,
    storeId: event.sale.storeId,
  };
  return { saleId: event.sale.id, run: () => acceptSale(db, principal, event, created.proof) };
}

const stored = (saleId: string) => databases().db.select().from(sale).where(eq(sale.id, saleId));

test("a customer id that belongs to another org is rejected and nothing is written", async () => {
  const foreign = await addCustomer({ orgId: ids.otherOrg, name: "Foreign Shopper" });
  const { saleId, run } = await accept(snapshot(foreign, { name: "Foreign Shopper" }));
  await expect(run()).rejects.toMatchObject({ code: "INVALID_REFERENCE" });
  expect(await stored(saleId)).toEqual([]);
});

test("a known customer keeps its own record and the sale links to it, whatever the snapshot says", async () => {
  const known = await addCustomer({ name: "Registered Name", phone: "0240000078" });
  const { saleId, run } = await accept(
    snapshot(known, { name: "Stale Snapshot", phone: "0240000078" }),
  );
  await run();
  const [saved] = await stored(saleId);
  expect(saved).toMatchObject({ customerId: known, eventVersion: 6 });
  expect(await serverCustomer(known)).toMatchObject({ name: "Registered Name", version: 1 });
});

test("a snapshot that is no valid customer never refuses the sale; it links nothing", async () => {
  const id = "019a0000-0000-7000-8000-0000000000d1";
  const { saleId, run } = await accept(snapshot(id, { phone: "not a phone", tin: "bad-tin" }));
  await run();
  expect(await stored(saleId)).toMatchObject([{ customerId: null, eventVersion: 6 }]);
  expect(await serverCustomer(id)).toBeUndefined();
});
