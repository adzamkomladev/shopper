// Attaching a customer to the basket: {type:"customer.attach", expectedRevision, customerId: uuid | null} answers the
// draft view with `view.customer` ({id,name,phone,kind,businessName,tin}, or null) and bumps the draft revision.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { startCounter } from "../../../support/customers/till";
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

const attach = (expectedRevision: number, customerId: string | null) =>
  counter!.ask({ type: "customer.attach", expectedRevision, customerId });

/** A register with one product in the basket (revision 1) that has pulled the portal's customer. */
async function basket(phone: string) {
  const id = v7();
  expect(
    (
      await portal.create({
        id,
        name: "Ama Mensah",
        phone,
        kind: "business",
        businessName: "Ama Stores",
        tin: "C0012345678",
      })
    ).status,
  ).toBe(201);
  counter = await startCounter();
  await counter.settle();
  const productId = counter.register.fixture.config.references.products[0].id;
  await counter.ask({ type: "add", expectedRevision: 0, productId });
  return id;
}

test("attaching sets the basket's customer, bumps the revision and survives a re-read", async () => {
  const id = await basket("0271000011");
  const attached = await attach(1, id);
  expect(attached).toMatchObject({
    type: "result",
    kind: "draft",
    view: {
      draft: { revision: 2 },
      customer: {
        id,
        name: "Ama Mensah",
        phone: "0271000011",
        kind: "business",
        businessName: "Ama Stores",
        tin: "C0012345678",
      },
    },
  });
  expect(JSON.stringify(attached)).not.toMatch(/creditLimit|credit_limit|email/);
  expect(await counter!.ask({ type: "readDraft" })).toMatchObject({
    view: { draft: { revision: 2 }, customer: { id } },
  });
});

test("null detaches the customer and the basket keeps its lines", async () => {
  const id = await basket("0271000012");
  await attach(1, id);
  const detached = await attach(2, null);
  expect(detached).toMatchObject({
    kind: "draft",
    view: { draft: { revision: 3 }, customer: null },
  });
  expect((detached as { view: { draft: { lines: unknown[] } } }).view.draft.lines).toHaveLength(1);
  expect(await counter!.ask({ type: "readDraft" })).toMatchObject({ view: { customer: null } });
});

test("a customer created offline can be attached before it has uploaded", async () => {
  counter = await startCounter();
  await counter.offline();
  const { customer } = await counter.create({ name: "Kofi Mensah", phone: "0241234567" });
  const productId = counter.register.fixture.config.references.products[0].id;
  await counter.ask({ type: "add", expectedRevision: 0, productId });
  expect(await attach(1, customer.id)).toMatchObject({
    view: { customer: { id: customer.id, name: "Kofi Mensah" } },
  });
});

test("a stale revision, an unknown id and an archived customer are refused and change nothing", async () => {
  const id = await basket("0271000013");
  expect(await attach(0, id)).toMatchObject({ type: "error", code: "REVISION_STALE" });
  expect(await attach(1, v7())).toMatchObject({ type: "error", code: "CUSTOMER_UNKNOWN" });
  expect(await counter!.ask({ type: "readDraft" })).toMatchObject({
    view: { draft: { revision: 1 }, customer: null },
  });

  expect((await portal.archive(id)).status).toBe(200);
  await counter!.sync();
  expect(await attach(1, id)).toMatchObject({ type: "error", code: "CUSTOMER_UNKNOWN" });
});

test("without customer.read the register cannot attach", async () => {
  counter = await startCounter({ without: ["customer.read"] });
  const productId = counter.register.fixture.config.references.products[0].id;
  await counter.ask({ type: "add", expectedRevision: 0, productId });
  expect(await attach(1, v7())).toMatchObject({ type: "error", code: "permission" });
});

test("a customer can be attached before the first scan: the basket opens with them and keeps them", async () => {
  counter = await startCounter();
  const { customer } = await counter.create({ name: "Esi Owusu", phone: "0241234568" });
  expect(await attach(0, null)).toMatchObject({
    kind: "draft",
    view: { draft: null, customer: null },
  });
  expect(await attach(3, customer.id)).toMatchObject({ type: "error", code: "REVISION_STALE" });
  expect(await attach(0, customer.id)).toMatchObject({
    kind: "draft",
    view: { draft: { revision: 1, lines: [] }, customer: { id: customer.id, name: "Esi Owusu" } },
  });
  const productId = counter.register.fixture.config.references.products[0].id;
  expect(await counter.ask({ type: "add", expectedRevision: 1, productId })).toMatchObject({
    view: { draft: { revision: 2 }, customer: { id: customer.id } },
  });
});
