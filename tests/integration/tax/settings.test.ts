// Tax settings: GET/PUT /settings/tax { tin, vatRegisteredFrom, priceMode, cashRounding }. Reading needs
// tax.read and changing them tax.write (super admin). A change reaches every store's feed as one org-setting row.
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { decodeReferenceChange } from "@shopper/core/schemas";
import { api, context, cookies, db, request } from "../auth/setup";

const read = async (who: string) => {
  const response = await request(api, cookies.get(who)!, "/settings/tax");
  return { status: response.status, body: await response.json() };
};
const save = async (who: string, body: unknown) => {
  const response = await request(api, cookies.get(who)!, "/settings/tax", "PUT", body);
  return { status: response.status, body: await response.json() };
};
const valid = {
  tin: "C0012345678",
  vatRegisteredFrom: "2026-01-01",
  priceMode: "exclusive",
  cashRounding: "none",
};
const audits = async () =>
  (await db.select().from(schema.auditLog).where(eq(schema.auditLog.orgId, context.orgId))).filter(
    (row) => row.command === "tax.settings.set",
  );

test("a new org is VAT-registered, inclusive, rounding cash to 10p, with no TIN yet", async () => {
  const { status, body } = await read("accountant");
  expect(status).toBe(200);
  expect(body).toEqual({
    tin: null,
    vatRegisteredFrom: "2000-01-01",
    priceMode: "inclusive",
    cashRounding: "10p",
  });
});

test("reading needs tax.read and changing needs tax.write", async () => {
  expect((await read("cashier")).status).toBe(403);
  expect((await read("inventory")).status).toBe(403);
  expect((await save("admin", valid)).status).toBe(403);
  expect((await save("accountant", valid)).status).toBe(403);
  expect((await request(api, "no-session", "/settings/tax")).status).toBe(401);
  expect((await read("admin")).body.priceMode).toBe("inclusive");
});

test("a VAT-registered org must give its TIN, and bad values change nothing", async () => {
  const before = JSON.stringify((await read("superadmin")).body);
  for (const body of [
    { ...valid, tin: null },
    { ...valid, tin: "12345" },
    { ...valid, vatRegisteredFrom: "2026-02-30" },
    { ...valid, priceMode: "net" },
    { ...valid, cashRounding: "5p" },
    { tin: valid.tin },
  ])
    expect((await save("superadmin", body)).status, JSON.stringify(body)).toBe(400);
  expect(JSON.stringify((await read("superadmin")).body)).toBe(before);
});

test("saving stores the settings, audits the change and sends one org-setting row to each store", async () => {
  const store = await request(api, cookies.get("superadmin")!, "/stores", "POST", {
    name: "Tax store",
  });
  expect(store.status).toBe(201);
  const storeId = (await store.json()).id as string;
  const before = (await audits()).length;

  const put = await save("superadmin", valid);
  expect(put.status).toBe(200);
  expect(put.body).toEqual(valid);
  expect((await read("accountant")).body).toEqual(valid);
  const [row] = await db.select().from(schema.org).where(eq(schema.org.id, context.orgId));
  expect(row).toMatchObject({
    tin: valid.tin,
    vatRegisteredFrom: "2026-01-01",
    priceMode: "exclusive",
    cashRounding: "none",
  });
  const audit = await audits();
  expect(audit).toHaveLength(before + 1);

  const feed = await db
    .select()
    .from(schema.storeChange)
    .where(
      and(eq(schema.storeChange.storeId, storeId), eq(schema.storeChange.entity, "org-setting")),
    );
  expect(feed).toHaveLength(1);
  const change = decodeReferenceChange({ ...feed[0]!, seq: feed[0]!.seq.toString() });
  expect(change).toMatchObject({ v: 5, op: "upsert", entityId: context.orgId });
  expect(change.payload).toEqual({ id: context.orgId, ...valid });

  // An unregistered shop has no TIN to give.
  const off = { tin: null, vatRegisteredFrom: null, priceMode: "inclusive", cashRounding: "10p" };
  expect((await save("superadmin", off)).body).toEqual(off);
});
