import { beforeAll, beforeEach, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { storeChange } from "@shopper/db-pg";
import { api, auth, baseURL, cookies, otherApi } from "../../auth/setup";
import { auditRowsFor, call, context, db, request } from "../support";
import { clearMappings, createMapping, ghost, listMappings, price, weight } from "./support";

const path = "/catalogue/barcodes/mappings";
beforeEach(clearMappings);
// The feed has no rows without a store, so make sure the organisation owns one.
beforeAll(async () => {
  expect((await call("/stores", "POST", { name: "Mapping store" })).status).toBe(201);
});

const feedFor = (id: string) =>
  db
    .select()
    .from(storeChange)
    .where(and(eq(storeChange.orgId, context.orgId), eq(storeChange.entityId, id)));

test("a mapping is created, listed, patched and deleted through the API", async () => {
  const created = await createMapping(weight());
  expect(created).toMatchObject({ id: expect.any(String), ...weight() });
  expect(await listMappings()).toEqual([created]);

  const patched = await call(`${path}/${created.id}`, "PATCH", { decimals: 2, unit: "kg" });
  expect(patched.status).toBe(200);
  expect(await patched.json()).toMatchObject({ id: created.id, decimals: 2, unit: "kg" });

  expect((await call(`${path}/${created.id}`, "DELETE")).status).toBe(204);
  expect(await listMappings()).toEqual([]);
});

test("each mutation leaves an audit row by the signed-in actor and a feed row", async () => {
  const principal = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("admin")! } }),
  );
  const created = await createMapping(price(), "admin");
  await call(`${path}/${created.id}`, "PATCH", { decimals: 3 }, "admin");
  await call(`${path}/${created.id}`, "DELETE", undefined, "admin");

  const audit = await auditRowsFor(created.id);
  expect(audit.map((row) => row.command)).toEqual([
    "barcode-mapping.create",
    "barcode-mapping.update",
    "barcode-mapping.delete",
  ]);
  for (const row of audit) expect(row.actorId).toBe(principal!.userId);

  const feed = await feedFor(created.id);
  const ops = feed.map((row) => row.op);
  expect(feed.every((row) => row.entity === "barcode-mapping")).toBe(true);
  expect(ops.filter((op) => op === "delete").length).toBeGreaterThan(0);
  expect(ops.filter((op) => op === "upsert").length).toBe(
    2 * ops.filter((op) => op === "delete").length,
  );
});

test("invalid bodies are 400, a taken prefix is 409, unknown ids are 404, and none write anything", async () => {
  const existing = await createMapping(weight());
  const before = (await auditRowsFor(existing.id)).length;
  const bad = [
    weight({ prefix: 19 }),
    weight({ kind: "volume" }),
    weight({ unit: "lb" }),
    weight({ value: { start: 6, length: 6 } }),
    price({ decimals: 5 }),
    weight({ orgId: context.orgId }),
  ];
  for (const body of bad)
    expect((await call(path, "POST", body)).status, JSON.stringify(body)).toBe(400);
  expect((await call(path, "POST", weight())).status).toBe(409);
  expect((await call(path, "POST", "{")).status).toBe(400);
  expect((await call(`${path}/${existing.id}`, "PATCH", {})).status).toBe(400);
  expect((await call(`${path}/${existing.id}`, "PATCH", { orgId: context.orgId })).status).toBe(
    400,
  );
  expect((await call(`${path}/${ghost}`, "PATCH", { decimals: 1 })).status).toBe(404);
  expect((await call(`${path}/${ghost}`, "DELETE")).status).toBe(404);
  expect((await call(`${path}/not-a-uuid`, "DELETE")).status).toBe(404);

  expect(await listMappings()).toEqual([existing]);
  expect((await auditRowsFor(existing.id)).length).toBe(before);
  expect(await feedFor(ghost)).toEqual([]);
});

test("reads need product.read and writes product.write; anonymous callers get 401", async () => {
  const target = await createMapping(weight({ prefix: 24 }));
  for (const role of ["superadmin", "admin", "accountant", "inventory", "cashier"]) {
    const writer = role === "superadmin" || role === "admin";
    expect((await call(path, "GET", undefined, role)).status, `${role} GET`).toBe(200);
    const denied = writer ? 201 : 403;
    const post = await call(path, "POST", weight({ prefix: 25 }), role);
    expect(post.status, `${role} POST`).toBe(denied);
    expect(
      (await call(`${path}/${target.id}`, "PATCH", { decimals: 1 }, role)).status,
      `${role} PATCH`,
    ).toBe(writer ? 200 : 403);
    if (writer) await clearOwn(post);
  }
  expect((await call(`${path}/${target.id}`, "DELETE", undefined, "cashier")).status).toBe(403);
  expect((await call(`${path}/${target.id}`, "DELETE", undefined, "inventory")).status).toBe(403);
  expect((await listMappings()).some((m) => m.id === target.id)).toBe(true);
  expect((await api.request(path)).status).toBe(401);
  expect((await api.request(path, { method: "POST", body: JSON.stringify(weight()) })).status).toBe(
    401,
  );
});

async function clearOwn(created: Response) {
  const { id } = (await created.json()) as { id: string };
  expect((await call(`${path}/${id}`, "DELETE")).status).toBe(204);
}

test("another organisation neither sees nor changes a mapping and may reuse its prefix", async () => {
  const mine = await createMapping(weight());
  const other = cookies.get("other")!;
  const asOther = (route: string, method = "GET", body?: unknown) =>
    request(otherApi, other, route, method, body);

  expect(await (await asOther(path)).json()).toEqual([]);
  expect((await asOther(`${path}/${mine.id}`, "PATCH", { decimals: 3 })).status).toBe(404);
  expect((await asOther(`${path}/${mine.id}`, "DELETE")).status).toBe(404);
  expect(await listMappings()).toEqual([mine]);

  const reused = await asOther(path, "POST", weight());
  expect(reused.status).toBe(201);
  const theirs = (await reused.json()) as { id: string };
  expect((await asOther(`${path}/${theirs.id}`, "DELETE")).status).toBe(204);
  expect(await listMappings()).toEqual([mine]);
});
