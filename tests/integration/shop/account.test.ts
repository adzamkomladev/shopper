// Day 30 done-when: an in-store customer signs in to the shop with a texted code and sees their till receipts and
// points. The account reads only sales rung up to customer rows with the signed-in phone (and rows merged into them).
//   GET  /shop/account/receipts           -> { items: [{ id, receiptNumber, occurredAt, total, status, branchName, pdf }] }
//   GET  /shop/account/receipts/:id       -> { ...item, receipt }  (the stored receipt document; 404 if not theirs)
//   GET  /shop/account/receipts/:id/pdf   -> 302 to a 60 s grant on the till's PDF; 404 until one is linked
//   GET  /shop/account/points             -> { enabled, points, tier, entries }
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { asset, org, sale } from "@shopper/db-pg";
import type { Blobs, Renderer } from "@shopper/ports";
import { goldenWorld } from "../../support/sales/golden/setup";
import { addCustomer } from "../../support/customers/seed";
import { freshSale, pushSale, sameTillSale } from "../../support/customers/credit";
import { cashSaleEvent, pointsFold } from "../../support/customers/loyalty";
import { setOrg } from "../../support/customers/due";
import { ids } from "../../support/till/sales";
import { databases } from "../../support/till/server";
import { shopHttp } from "../../support/shop/http";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";

const PHONE = "0277300001";
let world: Awaited<ReturnType<typeof goldenWorld>>;
let http: ReturnType<typeof shopHttp>;
let shop: { slug: string };
const grants: { orgId: string; key: string; seconds: number }[] = [];
let rendered = 0;
let mine: { id: string; receiptNumber: string | null };
let merged: string;
let theirs: string;

beforeAll(async () => {
  world = await goldenWorld();
  await setOrg({ loyalty_enabled: true, loyalty_earn_bps: 100, loyalty_point_value: 100 });
  const db = databases().db;
  const blobs = {
    createDownload: async (orgId: string, key: string, seconds: number) => {
      grants.push({ orgId, key, seconds });
      return `https://blobs.test/${key}?expires=${seconds}`;
    },
  } as unknown as Blobs;
  const renderer = {
    receipt: async () => {
      rendered += 1;
      throw new Error("the shop never renders a receipt on view");
    },
  } as unknown as Renderer;
  http = shopHttp({ db, queue: { send: async () => {} } as never }, { blobs, renderer });
  const [found] = await db.select({ slug: org.slug }).from(org).where(eq(org.id, ids.org));
  shop = { slug: found!.slug };

  const customer = await addCustomer({ phone: PHONE });
  // A duplicate staff merged into this customer: its sale is theirs too.
  const duplicate = await addCustomer({ phone: "0277300009" });
  const other = await addCustomer({ phone: "0277300002" });
  const first = await freshSale();
  expect((await pushSale(first, cashSaleEvent(first, customer))).body.accepted).toHaveLength(1);
  const second = await sameTillSale();
  expect((await pushSale(second, cashSaleEvent(second, duplicate))).body.accepted).toHaveLength(1);
  const third = await sameTillSale();
  expect((await pushSale(third, cashSaleEvent(third, other))).body.accepted).toHaveLength(1);
  await db.execute(
    sql`UPDATE customer SET merged_into_id = ${customer}, archived_at = now() WHERE org_id = ${ids.org} AND id = ${duplicate}`,
  );
  mine = { id: first.event.sale.id, receiptNumber: first.event.sale.receiptNumber };
  merged = second.event.sale.id;
  theirs = third.event.sale.id;
}, 120_000);
afterAll(async () => {
  http?.close();
  await world?.local.close();
});

const json = async (response: Response) => ({
  status: response.status,
  body: await response.json().catch(() => null),
});

test("an in-store customer signs in with a code and sees their till receipts and points", async () => {
  const cookie = await http.signIn(shop, "+233 27 730 0001");

  const receipts = await json(await http.request("/shop/account/receipts", { cookie }));
  expect(receipts.status).toBe(200);
  const listed = receipts.body.items.map((item: { id: string }) => item.id);
  expect(listed.sort()).toEqual([mine.id, merged].sort());
  expect(listed).not.toContain(theirs);
  expect(receipts.body.items.find((item: { id: string }) => item.id === mine.id)).toMatchObject({
    receiptNumber: mine.receiptNumber,
    total: expect.any(Number),
    status: "completed",
    pdf: false,
  });

  const one = await json(await http.request(`/shop/account/receipts/${mine.id}`, { cookie }));
  expect(one.status).toBe(200);
  expect(one.body.receipt.header).toMatchObject({ receiptNumber: mine.receiptNumber });

  const points = await json(await http.request("/shop/account/points", { cookie }));
  expect(points.status).toBe(200);
  const [customer] = (
    await databases().db.execute<{ id: string }>(
      sql`SELECT id FROM customer WHERE org_id = ${ids.org} AND phone = ${PHONE}`,
    )
  ).rows;
  expect(points.body.enabled).toBe(true);
  expect(points.body.points).toBeGreaterThan(0);
  expect(points.body.points).toBe(
    (await pointsFold(customer!.id)) +
      (await pointsFold(
        (
          await databases().db.execute<{ id: string }>(
            sql`SELECT id FROM customer WHERE org_id = ${ids.org} AND merged_into_id = ${customer!.id}`,
          )
        ).rows[0]!.id,
      )),
  );
  expect(points.body.entries[0]).toMatchObject({ reason: "earn", saleId: expect.any(String) });
});

test("a receipt of another phone is not found, even by id", async () => {
  const cookie = await http.signIn(shop, PHONE);
  expect((await http.request(`/shop/account/receipts/${theirs}`, { cookie })).status).toBe(404);
  expect((await http.request(`/shop/account/receipts/${theirs}/pdf`, { cookie })).status).toBe(404);
  expect((await http.request(`/shop/account/receipts/not-a-sale`, { cookie })).status).toBe(404);
});

test("the PDF is the till's own copy behind a short grant, once it is linked and verified", async () => {
  const cookie = await http.signIn(shop, PHONE);
  const pdf = () => http.request(`/shop/account/receipts/${mine.id}/pdf`, { cookie });
  expect((await pdf()).status).toBe(404);

  const db = databases().db;
  const id = v7();
  const key = `receipts/${mine.id}.pdf`;
  await db.insert(asset).values({
    id,
    orgId: ids.org,
    purpose: "sale_receipt",
    bucket: "receipts",
    visibility: "private",
    key,
    fileName: `${mine.id}.pdf`,
    contentType: "application/pdf",
    sizeBytes: 1200,
    sha256: "a".repeat(64),
  });
  await db
    .update(sale)
    .set({ receiptAssetId: id })
    .where(and(eq(sale.orgId, ids.org), eq(sale.id, mine.id)));
  // Linked but not yet verified in storage: still nothing to hand out.
  expect((await pdf()).status).toBe(404);

  await db
    .update(asset)
    .set({ verifiedSha256: "a".repeat(64) })
    .where(and(eq(asset.orgId, ids.org), eq(asset.id, id)));
  const response = await pdf();
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(`https://blobs.test/${key}?expires=60`);
  expect(grants.at(-1)).toEqual({ orgId: ids.org, key, seconds: 60 });
  const listed = await json(await http.request("/shop/account/receipts", { cookie }));
  expect(listed.body.items.find((item: { id: string }) => item.id === mine.id).pdf).toBe(true);
  expect(rendered).toBe(0);
});

test("a phone the shop has never seen gets an empty account, not an error", async () => {
  const cookie = await http.signIn(shop, "0277300099");
  expect((await json(await http.request("/shop/account/receipts", { cookie }))).body).toEqual({
    items: [],
  });
  expect((await json(await http.request("/shop/account/points", { cookie }))).body).toMatchObject({
    enabled: true,
    points: 0,
    tier: null,
    entries: [],
  });
});

test("the same phone at another shop sees none of this shop's receipts", async () => {
  const context = provisioningContext();
  const slug = `elsewhere-${Date.now().toString(36)}`;
  await provisionOrg(databases().db, context, { name: "Elsewhere Mart", slug });
  const cookie = await http.signIn({ slug }, PHONE);
  expect((await json(await http.request("/shop/account/receipts", { cookie }))).body).toEqual({
    items: [],
  });
  expect((await http.request(`/shop/account/receipts/${mine.id}`, { cookie })).status).toBe(404);
  expect((await http.request("/shop/account/receipts")).status).toBe(401);
});
