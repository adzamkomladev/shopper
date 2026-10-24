// Editing at the till: the change shows in the lookup at once, offline, and uploads as `customer.updated` v1 with the
// version the till last saw. A conflicting portal edit never blocks the queue: fields resolve last-writer-wins.
//   {type:"customer.update", customerId, name?, phone?, kind?, businessName?, tin?} -> {kind:"customer", customer:{..., pending}}
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { serverCustomer, startCounter, tillAudit } from "../../../support/customers/till";
import { ids } from "../../../support/till/sales";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  portal = customerApi(owner, owner.cookie);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

/** A customer the portal created and a register that has pulled it. */
async function known(phone: string) {
  const id = v7();
  expect((await portal.create({ id, name: "Ama Mensah", phone })).status).toBe(201);
  counter = await startCounter();
  await counter.sync();
  await counter.sync();
  expect(await counter.find(phone)).toMatchObject({
    customers: [{ id, version: 1, pending: false }],
  });
  return id;
}

test("an offline edit shows in the lookup at once, then uploads and the server audits customer.till.update", async () => {
  const id = await known("0271000001");
  await counter!.offline();
  const edit = await counter!.ask({
    type: "customer.update",
    customerId: id,
    name: "Ama Owusu",
    phone: "027 100 0002",
  });
  expect(edit).toMatchObject({
    type: "result",
    kind: "customer",
    customer: { id, name: "Ama Owusu", phone: "0271000002", pending: true },
  });
  expect(await counter!.find("0271000001")).toMatchObject({ customers: [] });
  expect(await counter!.find("0271000002")).toMatchObject({
    customers: [{ id, name: "Ama Owusu" }],
  });
  expect(await serverCustomer(id)).toMatchObject({ name: "Ama Mensah", version: 1 });
  expect(await counter!.register.audit("till.customer.update")).toHaveLength(1);

  await counter!.online();
  expect(counter!.wire()).toEqual(["sale", "customer.updated"]);
  expect(counter!.uploads()[0]!.request).toMatchObject({
    customer: {
      v: 1,
      type: "customer.updated",
      customer: { id, baseVersion: 1, changes: { name: "Ama Owusu", phone: "0271000002" } },
    },
  });
  expect(await serverCustomer(id)).toMatchObject({
    name: "Ama Owusu",
    phone: "0271000002",
    version: 2,
  });
  const audit = await tillAudit("customer.till.update", id);
  expect(audit).toHaveLength(1);
  expect(audit[0]!.payload).toMatchObject({ baseVersion: 1, currentVersion: 1 });
  expect(await counter!.find("0271000002")).toMatchObject({
    customers: [{ id, name: "Ama Owusu", version: 2, pending: false }],
  });
});

test("a customer created and edited offline uploads in that order and the server ends on the edit", async () => {
  counter = await startCounter();
  await counter.offline();
  const { customer } = await counter.create({ name: "Kofi Mensah", phone: "0241234567" });
  await counter.ask({ type: "customer.update", customerId: customer.id, name: "Kofi Annan" });
  expect(await counter.find("0241234567")).toMatchObject({ customers: [{ name: "Kofi Annan" }] });
  await counter.online();

  expect(counter.wire()).toEqual(["sale", "customer.created", "customer.updated"]);
  expect(await serverCustomer(customer.id)).toMatchObject({ name: "Kofi Annan", version: 2 });
  expect(await tillAudit("customer.till.create", customer.id)).toHaveLength(1);
  expect(await tillAudit("customer.till.update", customer.id)).toHaveLength(1);
});

test("a concurrent portal edit resolves per field, both versions are audited and the queue still drains", async () => {
  const id = await known("0271000003");
  await counter!.offline();
  await counter!.ask({
    type: "customer.update",
    customerId: id,
    name: "Till Name",
    tin: "C0012345678",
  });
  // The portal edits the name after the till did, before the till can say so.
  expect((await portal.patch(id, { name: "Portal Name" })).body.version).toBe(2);
  await counter!.online();

  // The name was last written by the portal; the TIN only by the till.
  expect(await serverCustomer(id)).toMatchObject({
    name: "Portal Name",
    tin: "C0012345678",
    version: 3,
  });
  const [audit] = await tillAudit("customer.till.update", id);
  expect(audit!.payload).toMatchObject({ baseVersion: 1, currentVersion: 2 });
  expect(counter!.wire()).toEqual(["sale", "customer.updated"]);
  const rows = await counter!.register.fixture.database.read((tx) =>
    tx.all<{ blocked_code: string | null; accepted_at: string | null }>(
      sql`SELECT blocked_code, accepted_at FROM customer_upload`,
    ),
  );
  expect(rows).toEqual([{ blocked_code: null, accepted_at: expect.any(String) }]);

  // The till converges on the server's answer and keeps selling and pushing.
  expect(await counter!.find("0271000003")).toMatchObject({
    customers: [{ name: "Portal Name", tin: "C0012345678", version: 3, pending: false }],
  });
  await counter!.register.sell([{ kind: "cash", amount: 12_000 }]);
  await counter!.sync();
  expect(counter!.wire()).toEqual(["sale", "customer.updated", "sale"]);
});

test("the credit limit cannot be edited from the till", async () => {
  const id = await known("0271000004");
  expect(
    await counter!.ask({ type: "customer.update", customerId: id, creditLimit: 5_000_000 }),
  ).toMatchObject({ type: "error", code: "INVALID_MESSAGE" });
  expect((await serverCustomer(id))!.credit_limit).toBe("0");
});

test("editing an unknown customer or sending no change is refused and writes nothing", async () => {
  const id = await known("0271000005");
  expect(
    await counter!.ask({ type: "customer.update", customerId: v7(), name: "Nobody" }),
  ).toMatchObject({ type: "error", code: "CUSTOMER_UNKNOWN" });
  expect(await counter!.ask({ type: "customer.update", customerId: id })).toMatchObject({
    type: "error",
    code: "INVALID_INPUT",
  });
  expect(
    await counter!.ask({ type: "customer.update", customerId: id, kind: "business" }),
  ).toMatchObject({
    type: "error",
    code: "INVALID_INPUT",
  });
  expect(await counter!.register.audit("till.customer.update")).toHaveLength(0);
});

test.each([
  ["ARCHIVED", (id: string) => portal.archive(id)],
  [
    "MERGED",
    async (id: string) => {
      const winner = v7();
      await portal.create({ id: winner, name: "Winner Ama", phone: "0271000007" });
      return portal.merge(winner, id);
    },
  ],
])(
  "an edit to a customer who was %s is rejected, the queue moves on and the next sale pushes",
  async (code, leave) => {
    const id = await known(code === "MERGED" ? "0271000006" : "0271000008");
    await counter!.offline();
    await counter!.ask({ type: "customer.update", customerId: id, name: "Too Late" });
    expect((await leave(id)).status).toBe(200);
    const before = await serverCustomer(id);
    await counter!.online();

    expect(await serverCustomer(id)).toEqual(before);
    const rows = await counter!.register.fixture.database.read((tx) =>
      tx.all<{ blocked_code: string | null; accepted_at: string | null }>(
        sql`SELECT blocked_code, accepted_at FROM customer_upload`,
      ),
    );
    expect(rows).toEqual([{ blocked_code: code, accepted_at: null }]);
    await counter!.register.sell([{ kind: "cash", amount: 12_000 }]);
    await counter!.sync();
    expect(counter!.wire()).toEqual(["sale", "customer.updated", "sale"]);
    expect(counter!.uploads()).toHaveLength(1);
  },
);
