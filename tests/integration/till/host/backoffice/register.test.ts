// The offline-capable register routes behind the desktop cookie; permissions come from the signed-in session.
import { afterEach, expect, test } from "vite-plus/test";
import { ama, startStaffHost, type StaffHost } from "../../../../support/till/host/staff";

let ctx: StaffHost | undefined;
afterEach(async () => ctx?.close());

const today = () => new Date().toISOString().slice(0, 10);
const json = { "content-type": "application/json" };

async function signedIn(permissions = ama.permissions) {
  ctx = await startStaffHost([{ ...ama, permissions }]);
  await ctx.signIn(ama.email, ama.password);
  return ctx;
}

test("the day report is served as JSON and CSV to a user with report.read", async () => {
  const c = await signedIn();
  const productId = c.fixture.config.references.products[0].id;
  await c.host.request({ type: "add", expectedRevision: 0, productId });
  await c.host.request({ type: "tender.add", expectedRevision: 1, kind: "cash", amount: 12_000 });
  await c.host.request({ type: "sale.complete", expectedRevision: 2 });

  const range = `from=${today()}&to=${today()}`;
  const report = await (await c.call(`/api/register/report?${range}`)).json();
  expect(report).toMatchObject({
    totals: { sales: 12_000, transactions: 1 },
    tenders: [{ method: "cash" }],
  });
  const csv = await c.call(`/api/register/report.csv?${range}`);
  expect(csv.headers.get("content-type")).toMatch(/text\/csv/);
  expect(await csv.text()).toContain("Total sales,1.20");
  expect((await c.call("/api/register/report?from=bad&to=worse")).status).toBe(400);
});

test("stock documents queue on POST, list on GET and upload to the server", async () => {
  const c = await signedIn();
  const productId = c.fixture.config.references.products[0].id;
  const queued = await c.call("/api/register/stock", {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      kind: "count",
      countedAt: new Date().toISOString(),
      lines: [{ productId, countedThousandths: 4_000 }],
    }),
  });
  expect(queued.status).toBe(201);
  const { id } = await queued.json();
  const listed = async () =>
    (await (await c.call("/api/register/stock")).json()) as { id: string; status: string }[];
  await expect.poll(async () => (await listed())[0]?.status, { timeout: 10_000 }).toBe("sent");
  expect((await listed())[0]!.id).toBe(id);
  expect(c.upstream.requests.filter((request) => request.path === "/sync/stock")).toHaveLength(1);
  expect(
    (await c.call("/api/register/stock", { method: "POST", headers: json, body: "{}" })).status,
  ).toBe(400);
});

test("each route refuses a session without its permission, and a signed-out register", async () => {
  const c = await signedIn(["report.read", "stock.read"]);
  const productId = c.fixture.config.references.products[0].id;
  expect((await c.call(`/api/register/report?from=${today()}&to=${today()}`)).status).toBe(200);
  expect((await c.call("/api/register/stock")).status).toBe(200);
  const write = await c.call("/api/register/stock", {
    method: "POST",
    headers: json,
    body: JSON.stringify({
      kind: "count",
      countedAt: new Date().toISOString(),
      lines: [{ productId, countedThousandths: 1 }],
    }),
  });
  expect(write.status).toBe(403);

  c.upstream.users.get(ama.email)!.permissions = ["stock.read"];
  await c.signIn(ama.email, ama.password);
  expect((await c.call(`/api/register/report.csv?from=${today()}&to=${today()}`)).status).toBe(403);
  expect((await c.call("/api/register/stock")).status).toBe(200);

  await c.signOut();
  expect((await c.call("/api/register/stock")).status).toBe(401);
});

test("product search answers from the till catalogue for stock.read", async () => {
  const c = await signedIn();
  const [product] = c.fixture.config.references.products;
  const found = await (
    await c.call(`/api/register/products?q=${encodeURIComponent(product.sku)}`)
  ).json();
  expect(found).toEqual([expect.objectContaining({ productId: product.id, sku: product.sku })]);
});
