// What a shopper keeps on their online account: a name, an email and delivery addresses, one of them the default.
//   PATCH  /shop/account                  { name?, email? } -> the account
//   GET    /shop/account/addresses        -> { items } default first, then oldest first
//   POST   /shop/account/addresses        { label, line1, area, city, landmark?, phone, isDefault? } -> 201 address
//   PATCH  /shop/account/addresses/:id    same fields, all optional -> address
//   DELETE /shop/account/addresses/:id    -> 204
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { verifyChain } from "@shopper/audit";
import { auditLog, customer } from "@shopper/db-pg";
import { shopWorld } from "../../support/shop/world";
import { shopHttp } from "../../support/shop/http";

let world: Awaited<ReturnType<typeof shopWorld>>;
let http: ReturnType<typeof shopHttp>;
beforeAll(async () => {
  world = await shopWorld();
  http = shopHttp(world);
}, 120_000);
afterAll(async () => {
  http?.close();
  await world?.close();
});

const call = async (path: string, cookie: string, method = "GET", body?: unknown) => {
  const response = await http.request(path, { cookie, method, body });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const home = {
  label: "Home",
  line1: "12 Oxford Street",
  area: "Osu",
  city: "Accra",
  landmark: "Opposite the bank",
  phone: "024 555 0101",
};

test("a shopper names themself without touching the shop's customer record", async () => {
  await world.db.insert(customer).values({
    orgId: world.a.orgId,
    name: "Staff Spelling",
    phone: "0245550100",
  });
  const cookie = await http.signIn(world.a, "0245550100");
  const saved = await call("/shop/account", cookie, "PATCH", {
    name: "  Ama Mensah ",
    email: "ama@example.com",
  });
  expect(saved.status).toBe(200);
  expect(saved.body).toMatchObject({ name: "Ama Mensah", email: "ama@example.com" });
  expect((await call("/shop/account", cookie)).body).toMatchObject({ name: "Ama Mensah" });
  const [row] = await world.db
    .select({ name: customer.name })
    .from(customer)
    .where(and(eq(customer.orgId, world.a.orgId), eq(customer.phone, "0245550100")));
  expect(row!.name).toBe("Staff Spelling");

  expect((await call("/shop/account", cookie, "PATCH", { email: "not an email" })).status).toBe(
    400,
  );
  // Clearing is allowed: an empty field is no longer kept.
  const cleared = await call("/shop/account", cookie, "PATCH", { email: "" });
  expect(cleared, JSON.stringify(cleared)).toMatchObject({ status: 200, body: { email: null } });
});

test("addresses: the first is the default, a new default takes over, deleting it passes it on", async () => {
  const cookie = await http.signIn(world.a, "0245550200");
  const first = await call("/shop/account/addresses", cookie, "POST", home);
  expect(first.status).toBe(201);
  expect(first.body).toMatchObject({ label: "Home", phone: "0245550101", isDefault: true });

  const work = await call("/shop/account/addresses", cookie, "POST", {
    ...home,
    label: "Work",
    landmark: undefined,
  });
  expect(work.body).toMatchObject({ isDefault: false, landmark: null });
  const made = await call(`/shop/account/addresses/${work.body.id}`, cookie, "PATCH", {
    isDefault: true,
    area: "Airport",
  });
  expect(made.body).toMatchObject({ isDefault: true, area: "Airport", label: "Work" });
  const listed = (await call("/shop/account/addresses", cookie)).body.items;
  expect(listed.map((a: { label: string; isDefault: boolean }) => [a.label, a.isDefault])).toEqual([
    ["Work", true],
    ["Home", false],
  ]);

  expect(
    (await http.request(`/shop/account/addresses/${work.body.id}`, { cookie, method: "DELETE" }))
      .status,
  ).toBe(204);
  expect(
    (await call("/shop/account/addresses", cookie)).body.items.map(
      (a: { label: string; isDefault: boolean }) => [a.label, a.isDefault],
    ),
  ).toEqual([["Home", true]]);

  expect(
    (await call("/shop/account/addresses", cookie, "POST", { ...home, city: "" })).status,
  ).toBe(400);
  expect(
    (await call("/shop/account/addresses", cookie, "POST", { ...home, phone: "12345" })).status,
  ).toBe(400);
});

test("one shopper never reads or changes another's address", async () => {
  const owner = await http.signIn(world.a, "0245550300");
  const created = (await call("/shop/account/addresses", owner, "POST", home)).body;
  const stranger = await http.signIn(world.a, "0245550301");
  const elsewhere = await http.signIn(world.b, "0245550300");
  for (const cookie of [stranger, elsewhere]) {
    expect((await call("/shop/account/addresses", cookie)).body.items).toEqual([]);
    expect(
      (await call(`/shop/account/addresses/${created.id}`, cookie, "PATCH", { label: "Mine" }))
        .status,
    ).toBe(404);
    expect(
      (await http.request(`/shop/account/addresses/${created.id}`, { cookie, method: "DELETE" }))
        .status,
    ).toBe(404);
  }
  expect((await call("/shop/account/addresses", owner)).body.items[0].label).toBe("Home");
});

test("every change is an audited command whose chain verifies, with phones masked", async () => {
  const chain = await world.db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, world.a.orgId))
    .orderBy(auditLog.chainSeq);
  expect(await verifyChain(chain)).toMatchObject({ valid: true });
  const commands = new Set(chain.map((row) => row.command));
  for (const command of ["shop.profile.save", "shop.address.save", "shop.address.delete"])
    expect(commands).toContain(command);
  const saved = chain.filter((row) => row.command === "shop.address.save");
  expect(JSON.stringify(saved.map((row) => row.payload))).not.toContain("0245550101");
});
