import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, asc, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { auditLog, store, storeChange } from "@shopper/db-pg";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ids } from "../../fixtures/sales/golden";
import { databases } from "../../support/till/server";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { customerApi, type CustomerBody } from "../../support/customers/http";
import { addCustomer } from "../../support/customers/seed";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let admin: ReturnType<typeof customerApi>;
let cashier: ReturnType<typeof customerApi>;
let accountant: ReturnType<typeof customerApi>;
let inventory: ReturnType<typeof customerApi>;
const db = () => databases().db;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  admin = customerApi(owner, owner.cookie);
  cashier = customerApi(owner, await portalMember(owner, "cashier"));
  accountant = customerApi(owner, await portalMember(owner, "accountant"));
  inventory = customerApi(owner, await portalMember(owner, "inventory"));
  // A second store, so "every store of the org" is more than one.
  await db().insert(store).values({ id: v7(), orgId: ids.org, name: "Second store" });
});
afterAll(async () => {
  await world?.local.close();
});

const body = (over: Partial<CustomerBody> = {}): CustomerBody => ({
  id: v7(),
  name: "Ama Mensah",
  phone: "0241234567",
  kind: "individual",
  ...over,
});

test("a customer is created with 201 and a replay by client id answers 200; other content under the id is 409", async () => {
  const input = body({ email: "ama@example.test" });
  const created = await admin.create(input);
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({
    id: input.id,
    name: "Ama Mensah",
    phone: "0241234567",
    kind: "individual",
    email: "ama@example.test",
    version: 1,
    creditLimit: 0,
    balance: 0,
    points: 0,
    archivedAt: null,
    mergedIntoId: null,
  });
  const again = await admin.create(input);
  expect(again.status).toBe(200);
  expect(again.body).toMatchObject({ id: input.id, version: 1 });
  expect((await admin.create({ ...input, name: "Someone Else" })).status).toBe(409);
  const rows = await db().execute(sql`SELECT 1 FROM customer WHERE id = ${input.id}`);
  expect(rows.rows).toHaveLength(1);
});

test("phones are normalised to 0XXXXXXXXX; malformed phones, TINs and business names without a business are 400", async () => {
  for (const phone of ["+233241230001", "233241230002", "0241230003"]) {
    const created = await admin.create(body({ phone }));
    expect(created.status, phone).toBe(201);
    expect(created.body.phone).toBe(`0${phone.slice(-9)}`);
  }
  for (const phone of ["12345", "0241234", "+23324123456789", "abcdefghij"])
    expect((await admin.create(body({ phone }))).status, phone).toBe(400);

  const business = { kind: "business" as const, businessName: "Kofi Traders Ltd" };
  for (const tin of ["C0012345678", "P0000000001", "GHA-123456789-1"]) {
    const created = await admin.create(body({ ...business, tin }));
    expect(created.status, tin).toBe(201);
    expect(created.body).toMatchObject({ tin, businessName: "Kofi Traders Ltd", kind: "business" });
  }
  for (const tin of [
    "c0012345678",
    "C001234567",
    "C00123456789",
    "GHA-12345678-1",
    "GHA123456789-1",
    "123",
  ])
    expect((await admin.create(body({ ...business, tin }))).status, tin).toBe(400);

  expect((await admin.create(body({ kind: "business" }))).status).toBe(400);
  expect((await admin.create(body({ kind: "business", businessName: "" }))).status).toBe(400);
  expect((await admin.create(body({ kind: "company" as never }))).status).toBe(400);
  expect((await admin.create(body({ name: "" }))).status).toBe(400);
});

test("the list searches by name, phone and TIN, pages with a cursor and hides nothing of another org", async () => {
  const mark = `Zyx${v7().slice(-6)}`;
  const people = [
    body({ name: `${mark} Abena`, phone: "0551110001" }),
    body({ name: `${mark} Yaw`, phone: "0551110002" }),
    body({ name: `${mark} Esi`, phone: "0551110003" }),
    body({
      name: `${mark} Kwesi`,
      phone: "0551110004",
      kind: "business",
      businessName: `${mark} Co`,
      tin: "C0099999999",
    }),
  ];
  for (const person of people) expect((await admin.create(person)).status).toBe(201);
  await addCustomer({ orgId: ids.otherOrg, name: `${mark} Foreign` });

  const byName = await cashier.list(`q=${mark.toLowerCase()}`);
  expect(byName.status).toBe(200);
  expect(byName.body.items.map((c: { id: string }) => c.id).sort()).toEqual(
    people.map((p) => p.id).sort(),
  );
  const byPhone = await cashier.list("q=0551110002");
  expect(byPhone.body.items.map((c: { id: string }) => c.id)).toEqual([people[1]!.id]);
  const byTin = await cashier.list("q=C0099999999");
  expect(byTin.body.items.map((c: { id: string }) => c.id)).toEqual([people[3]!.id]);
  expect((await cashier.list(`q=${mark}nobody`)).body.items).toEqual([]);
  const businesses = await cashier.list(`q=${mark}&kind=business`);
  expect(businesses.body.items.map((c: { id: string }) => c.id)).toEqual([people[3]!.id]);
  expect((await cashier.list(`q=${mark}&kind=other`)).status).toBe(400);

  const seen: string[] = [];
  let cursor: string | null = null;
  const sizes: number[] = [];
  do {
    const page: Awaited<ReturnType<typeof admin.list>> = await admin.list(
      `q=${mark}&limit=3${cursor ? `&cursor=${cursor}` : ""}`,
    );
    sizes.push(page.body.items.length);
    seen.push(...page.body.items.map((c: { id: string }) => c.id));
    cursor = page.body.nextCursor;
  } while (cursor);
  expect(sizes).toEqual([3, 1]);
  expect(new Set(seen).size).toBe(4);
});

test("a customer is read by id; PATCH bumps the version and a malformed patch changes nothing", async () => {
  const input = body({ name: "Yaa Asantewaa", phone: "0201112223" });
  await admin.create(input);
  expect((await cashier.read(input.id)).body).toMatchObject({ id: input.id, version: 1 });

  const patched = await cashier.patch(input.id, {
    name: "Yaa Asantewaa II",
    phone: "+233201112224",
  });
  expect(patched.status).toBe(200);
  expect(patched.body).toMatchObject({ name: "Yaa Asantewaa II", phone: "0201112224", version: 2 });
  expect((await admin.patch(input.id, { email: "yaa@example.test" })).body.version).toBe(3);

  expect((await admin.patch(input.id, { phone: "123" })).status).toBe(400);
  expect((await admin.patch(input.id, { tin: "bad" })).status).toBe(400);
  expect((await admin.patch(input.id, { kind: "business" })).status).toBe(400);
  expect((await admin.read(input.id)).body).toMatchObject({ version: 3, phone: "0201112224" });
  expect((await admin.read(v7())).status).toBe(404);
});

test("another org's customer is 404 for read and patch and absent from the list", async () => {
  const foreign = await addCustomer({ orgId: ids.otherOrg, name: "Foreign Customer" });
  expect((await admin.read(foreign)).status).toBe(404);
  expect((await admin.patch(foreign, { name: "Taken over" })).status).toBe(404);
  expect((await admin.archive(foreign)).status).toBe(404);
  expect((await admin.list("q=Foreign Customer")).body.items).toEqual([]);
  const rows = await db().execute(sql`SELECT name, version FROM customer WHERE id = ${foreign}`);
  expect(rows.rows).toEqual([{ name: "Foreign Customer", version: 1 }]);
});

test("customer.read and customer.write are data: cashier reads and writes, accountant reads only, inventory has neither", async () => {
  const input = body({ name: "Gate Check" });
  expect((await cashier.create(input)).status).toBe(201);
  expect((await cashier.read(input.id)).status).toBe(200);
  expect((await cashier.patch(input.id, { name: "Gate Check 2" })).status).toBe(200);

  expect((await accountant.list()).status).toBe(200);
  expect((await accountant.read(input.id)).status).toBe(200);
  expect((await accountant.create(body())).status).toBe(403);
  expect((await accountant.patch(input.id, { name: "Nope" })).status).toBe(403);

  expect((await inventory.list()).status).toBe(403);
  expect((await inventory.read(input.id)).status).toBe(403);
  expect((await inventory.create(body())).status).toBe(403);
  expect((await owner.api.request("/customers")).status).toBe(401);
  expect((await accountant.read(input.id)).body.name).toBe("Gate Check 2");
});

test("the org has 37 permissions; only customer.read and customer.write are allowed on the till", async () => {
  const { rows } = await db().execute<{ code: string; till_allowed: boolean }>(
    sql`SELECT code, till_allowed FROM permission WHERE org_id = ${ids.org} ORDER BY code`,
  );
  expect(rows).toHaveLength(37);
  const customerCodes = rows.filter((r) => /^(customer\.|kyc\.)/.test(r.code));
  expect(customerCodes).toEqual([
    { code: "customer.manage", till_allowed: false },
    { code: "customer.read", till_allowed: true },
    { code: "customer.write", till_allowed: true },
    { code: "kyc.approve", till_allowed: false },
  ]);
});

test("create and update write audit rows on a valid chain and a customer change for every store", async () => {
  const input = body({ name: "Feed Check" });
  await admin.create(input);
  await admin.patch(input.id, { name: "Feed Check 2" });

  const audit = await db()
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, ids.org))
    .orderBy(asc(auditLog.chainSeq));
  const mine = audit.filter((row) => row.entity === "customer" && row.entityId === input.id);
  expect(mine.map((row) => row.command)).toEqual(["customer.create", "customer.update"]);
  expect(await verifyChain(audit as AuditEntry[])).toMatchObject({ valid: true });

  const stores = await db().select({ id: store.id }).from(store).where(eq(store.orgId, ids.org));
  expect(stores.length).toBeGreaterThan(1);
  const changes = await db()
    .select()
    .from(storeChange)
    .where(
      and(
        eq(storeChange.orgId, ids.org),
        eq(storeChange.entity, "customer"),
        eq(storeChange.entityId, input.id),
      ),
    );
  expect(changes.map((c) => c.op)).toEqual(Array(stores.length * 2).fill("upsert"));
  for (const s of stores)
    expect(
      changes.filter((c) => c.storeId === s.id),
      s.id,
    ).toHaveLength(2);

  const replay = await admin.create(input);
  expect(replay.status).toBe(200);
  const after = await db()
    .select()
    .from(storeChange)
    .where(and(eq(storeChange.orgId, ids.org), eq(storeChange.entityId, input.id)));
  expect(after).toHaveLength(changes.length);
});
