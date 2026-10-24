// Quick-create at the till: the customer is usable at once, offline; the create reaches the server through the
// document lane (after every pending sale) as `customer.created` v1 and is audited there as customer.till.create.
//   {type:"customer.find", phone}                          -> {kind:"customers", customers:[{id,name,phone,kind,businessName,tin,pending}]}
//   {type:"customer.create", name, phone, kind?, businessName?, tin?} -> {kind:"customer", customer:{..., pending}}
import { afterEach, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import {
  created,
  customersByPhone,
  serverCustomer,
  startCounter,
  tillAudit,
  upload,
  uploader,
  pause,
} from "../../../support/customers/till";
import { deviceId } from "../../../support/till/server";

let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

const kofi = { name: "Kofi Mensah", phone: "024 123 4567" };

test("an offline create is found by phone at once, whatever the spacing, and nothing has left the till", async () => {
  counter = await startCounter();
  await counter.offline();
  const made = await counter.create(kofi);
  expect(made).toMatchObject({
    type: "result",
    kind: "customer",
    customer: { name: "Kofi Mensah", phone: "0241234567", kind: "individual", pending: true },
  });
  const id = made.customer.id as string;
  for (const typed of ["024 123 4567", "0241234567", "+233 24 123 4567"])
    expect(await counter.find(typed)).toMatchObject({
      type: "result",
      kind: "customers",
      customers: [{ id, name: "Kofi Mensah", phone: "0241234567", pending: true }],
    });
  expect(await counter.find("0249999999")).toMatchObject({ kind: "customers", customers: [] });
  expect(counter.uploads()).toHaveLength(0);
  expect(await serverCustomer(id)).toBeUndefined();
  expect(await counter.register.audit("till.customer.create")).toHaveLength(1);
});

test("a business needs its name and a valid TIN, and a bad phone is refused before anything is written", async () => {
  counter = await startCounter();
  for (const bad of [
    { name: "Kofi", phone: "12345" },
    { name: "Kofi", phone: "0241234567", kind: "business" as const },
    {
      name: "Kofi Traders",
      phone: "0241234567",
      kind: "business" as const,
      businessName: "Kofi Traders Ltd",
      tin: "bad",
    },
    { name: "", phone: "0241234567" },
  ])
    expect(await counter.create(bad)).toMatchObject({ type: "error", code: "INVALID_INPUT" });
  expect(await counter.lookup()).toEqual([]);
  expect(await counter.register.audit("till.customer.create")).toHaveLength(0);

  const business = await counter.create({
    name: "Kofi Mensah",
    phone: "0241234567",
    kind: "business",
    businessName: "Kofi Traders Ltd",
    tin: "C0012345678",
  });
  expect(business).toMatchObject({
    kind: "customer",
    customer: { kind: "business", businessName: "Kofi Traders Ltd", tin: "C0012345678" },
  });
});

test("the create uploads after the pending sale, is audited customer.till.create, and the till then shows it as saved", async () => {
  counter = await startCounter();
  await counter.offline();
  const { customer } = await counter.create({ ...kofi, phone: "024 123 4563" });
  await counter.online();

  expect(counter.wire()).toEqual(["sale", "customer.created"]);
  expect(counter.uploads()[0]!.request).toMatchObject({
    proof: expect.any(String),
    customer: {
      v: 1,
      type: "customer.created",
      customer: { id: customer.id, name: "Kofi Mensah", phone: "0241234563", kind: "individual" },
    },
  });
  expect(await serverCustomer(customer.id)).toMatchObject({
    name: "Kofi Mensah",
    phone: "0241234563",
    kind: "individual",
    version: 1,
    credit_limit: "0",
    created_device_id: deviceId,
  });
  const audit = await tillAudit("customer.till.create", customer.id);
  expect(audit).toHaveLength(1);
  expect(audit[0]).toMatchObject({ entity: "customer", deviceId });
  expect(await counter.find("0241234563")).toMatchObject({
    customers: [{ id: customer.id, pending: false, version: 1 }],
  });
});

test("a create that reaches the server twice is a no-op the second time", async () => {
  counter = await startCounter();
  const { customer } = await counter.create({ ...kofi, phone: "024 123 4564" });
  await counter.settle();
  const body = counter.uploads()[0]!.request;
  const again = await upload(body);
  expect(again).toMatchObject({ status: 200, body: { accepted: { id: customer.id } } });
  expect(await customersByPhone("0241234564")).toEqual([customer.id]);
  expect(await tillAudit("customer.till.create", customer.id)).toHaveLength(1);
  expect((await serverCustomer(customer.id))!.version).toBe(1);

  // The same identity with other content is not silently merged into the first.
  const session = await uploader();
  const other = created(session, { id: customer.id, name: "Someone Else" });
  expect((await upload(other)).body).toMatchObject({ rejected: { code: "CONFLICT" } });
  expect((await serverCustomer(customer.id))!.name).toBe("Kofi Mensah");
});

test("two tills creating one phone leave two customers and the lookup lists the newer first", async () => {
  counter = await startCounter();
  await counter.offline();
  const first = (await counter.create({ ...kofi, phone: "024 123 4565" })).customer.id as string;
  // The other till's create reaches the server first, with a later identity.
  await pause(5);
  const second = v7();
  const other = await upload(
    created(await uploader(), { id: second, name: "Kofi M.", phone: "0241234565" }),
  );
  expect(other.body).toMatchObject({ accepted: { id: second } });
  await counter.online();

  expect(await customersByPhone("0241234565")).toEqual([second, first]);
  const found = await counter.find("0241234565");
  expect(found.customers.map((c: { id: string }) => c.id)).toEqual([second, first]);
  expect(found.customers.map((c: { pending: boolean }) => c.pending)).toEqual([false, false]);
});

test("without customer.write the register refuses to create and writes nothing; reading still works", async () => {
  counter = await startCounter({ without: ["customer.write"] });
  // Earlier tests left customers on the server, and the register has pulled them: compare, don't expect empty.
  const before = await counter.lookup();
  const unknown = { ...kofi, phone: "024 123 4566" };
  expect(await counter.create(unknown)).toMatchObject({ type: "error", code: "permission" });
  expect(await counter.lookup()).toEqual(before);
  expect(await counter.register.audit("till.customer.create")).toHaveLength(0);
  expect(await counter.find("0241234566")).toMatchObject({ kind: "customers", customers: [] });
  await counter.close();

  counter = await startCounter({ without: ["customer.read"] });
  expect(await counter.find("0241234567")).toMatchObject({
    type: "error",
    code: "permission",
  });
});
