// v1.5 Day 52: the field allowlist, over everything a box sends its relay in a whole run (catalogue, tax rules,
// customers, heartbeat; photos and order events are checked where they are sent: storefront and fulfilment tests). Every key of every request body is on its path's list,
// and nothing the shop keeps private (supplier, cost, an opted-out customer, a customer's TIN, credit or email, staff)
// appears anywhere in what leaves the box.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { databases } from "../../support/till/server";
import { goldenWorld } from "../../support/sales/golden/setup";
import { addCustomer } from "../../support/customers/seed";
import { freshSale, pushSale, sameTillSale } from "../../support/customers/credit";
import { cashSaleEvent } from "../../support/customers/loyalty";
import { setOrg } from "../../support/customers/due";
import { customersWorld } from "../../support/relay/customers";
import { expectAllowed } from "../../support/relay/allowlist";
import { ids } from "../../support/till/sales";

let golden: Awaited<ReturnType<typeof goldenWorld>>;
let w: Awaited<ReturnType<typeof customersWorld>>;

beforeAll(async () => {
  golden = await goldenWorld();
  await setOrg({ loyalty_enabled: true, loyalty_earn_bps: 100, loyalty_point_value: 100 });
  w = await customersWorld();
  const db = databases().db;
  // What the box knows and keeps: a supplier and what it charges, a customer's TIN, credit limit and email.
  await db.execute(sql`
    INSERT INTO supplier (org_id, name, phone, tin) VALUES (${ids.org}, 'Secret Wholesale Ltd', '0244111222', 'C0001234567')`);
  const shared = await addCustomer({
    phone: "0277310001",
    name: "Ama Shared",
    tin: "P0099887766",
    creditLimit: 5_000_000,
  });
  await db.execute(sql`UPDATE customer SET email = 'ama.private@example.com' WHERE id = ${shared}`);
  const hidden = await addCustomer({ phone: "0277310002", name: "Kofi Private" });
  const first = await freshSale();
  expect((await pushSale(first, cashSaleEvent(first, shared))).body.accepted).toHaveLength(1);
  const second = await sameTillSale();
  expect((await pushSale(second, cashSaleEvent(second, hidden))).body.accepted).toHaveLength(1);
  await w.share(shared, true);
  await w.run();
}, 180_000);
afterAll(async () => {
  await w?.close();
  await golden?.local.close();
});

test("no forbidden field in any request of a whole run", async () => {
  expectAllowed(w.sent, ["/relay/publish", "/relay/customers", "/relay/heartbeat"]);
  const wire = w.sent.map((request) => request.body).join("\n");
  expect(wire).toContain("0277310001");
  expect(wire).not.toMatch(
    /Secret Wholesale|0244111222|C0001234567|P0099887766|ama.private@example.com|Kofi Private|0277310002|unitCost|creditLimit|supplier|password/i,
  );
});
