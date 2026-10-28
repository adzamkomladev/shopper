// The setup wizard reads where a shop stands from the rows each step makes, so progress survives a reload and is
// never stored twice. The owner may skip Products, finish, or leave the wizard; each is one audited command. Every
// member may read the progress; only the owner (store.write) changes it, and another shop never sees it.
import { beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxCache } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { api, baseURL, context, cookies, db, otherApi, request, secret } from "../auth/setup";

const owner = (path: string, method = "GET", body?: unknown) =>
  request(api, cookies.get("superadmin")!, path, method, body);
const setup = async () => (await owner("/setup")).json();
const done = async () =>
  Object.fromEntries(
    ((await setup()).steps as { step: string; done: boolean }[]).map((s) => [s.step, s.done]),
  );

beforeAll(async () => {
  await db.insert(schema.onboarding).values({ orgId: context.orgId });
});

test("a new shop starts at the store step, with nothing done", async () => {
  const progress = await setup();
  expect(progress).toMatchObject({
    next: "store",
    status: "setup",
    finished: false,
    skipped: false,
  });
  expect(await done()).toEqual({
    store: false,
    branch: false,
    tax: false,
    products: false,
    team: false,
    till: false,
  });
});

test("each step is done once its rows exist", async () => {
  const store = await (await owner("/stores", "POST", { name: "Main store" })).json();
  expect((await setup()).next).toBe("branch");
  expect((await owner("/branches", "POST", { name: "Osu", storeId: store.id })).status).toBe(201);
  await db.update(schema.org).set({ tin: "C0012345678" }).where(eq(schema.org.id, context.orgId));
  expect(await done()).toMatchObject({ store: true, branch: true, tax: true, products: false });
  expect((await setup()).next).toBe("products");
});

test("skipping Products marks the catalogue once, in the audit chain", async () => {
  expect((await owner("/setup/products/skip", "POST")).status).toBe(200);
  expect((await owner("/setup/products/skip", "POST")).status).toBe(200);
  expect(await done()).toMatchObject({ products: true });
  const [row] = await db
    .select()
    .from(schema.onboarding)
    .where(eq(schema.onboarding.orgId, context.orgId));
  expect(row?.catalogueAt).toBeInstanceOf(Date);
  const audited = await db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, context.orgId),
        eq(schema.auditLog.command, "onboarding.setup.skip"),
      ),
    );
  expect(audited).toHaveLength(2);
});

test("finishing and leaving the wizard are recorded", async () => {
  expect((await owner("/setup/dismiss", "POST")).status).toBe(200);
  expect(await setup()).toMatchObject({ skipped: true, finished: false });
  expect((await owner("/setup/finish", "POST")).status).toBe(200);
  expect(await setup()).toMatchObject({ finished: true });
});

test("members read the progress; only the owner changes it", async () => {
  for (const role of ["admin", "accountant", "inventory", "cashier"]) {
    const cookie = cookies.get(role)!;
    expect((await request(api, cookie, "/setup")).status, role).toBe(200);
    for (const path of ["/setup/products/skip", "/setup/finish", "/setup/dismiss"])
      expect((await request(api, cookie, path, "POST")).status, `${role} ${path}`).toBe(403);
  }
  expect((await api.request("/setup")).status).toBe(401);
});

test("another shop reads only its own setup", async () => {
  const other = await (await request(otherApi, cookies.get("other")!, "/setup")).json();
  expect(other).toMatchObject({ next: "store", status: null });
  expect(other.steps.some((step: { done: boolean }) => step.done)).toBe(false);
  // Made without onboarding (as a box shop is): there is no wizard to finish.
  expect((await request(otherApi, cookies.get("other")!, "/setup/finish", "POST")).status).toBe(
    404,
  );
});

test("the shared runtime serves setup behind the session", async () => {
  const cache = boxCache(":memory:");
  const send = (headers: Record<string, string>) =>
    serveRuntime(new Request(`${baseURL}/setup`, { headers }), {
      database: db,
      cache: cache.cache,
      secret,
      baseURL,
    });
  const shop = { "X-Shopper-Org": context.orgId };
  expect((await send(shop)).status).toBe(401);
  expect((await send({ ...shop, cookie: cookies.get("superadmin")! })).status).toBe(200);
  cache.close();
});
