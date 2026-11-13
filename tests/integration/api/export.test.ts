// The export routes over HTTP: who may take the business's data, that nothing of another shop comes with it, and that
// a download is the verified archive the workflow made.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import * as XLSX from "xlsx";
import { boxArchiveExport } from "@shopper/adapters-box";
import { memoryLaunch } from "@shopper/adapters-box";
import { readZip, verifyArchive } from "@shopper/export";
import {
  SENTINEL,
  call,
  db,
  runtimeOptions,
  startTenants,
  stopTenants,
} from "../../support/security/tenants";

type Tenants = Awaited<ReturnType<typeof startTenants>>;
let a: Tenants["a"];
let b: Tenants["b"];
let archive: ReturnType<typeof boxArchiveExport>;
beforeAll(async () => {
  ({ a, b } = await startTenants());
  archive = boxArchiveExport({ database: db, blobs: runtimeOptions().blobs! }, memoryLaunch);
  runtimeOptions().archiveExports = archive.launcher;
}, 120_000);
afterAll(stopTenants);

const json = async (response: Response) => (await response.json()) as Record<string, any>;
async function makeArchive(as = a) {
  const started = await call(as, "/export/archives", { method: "POST" });
  expect(started.status).toBe(202);
  const { id } = (await json(started)) as { id: string };
  await (archive.launcher as unknown as { idle(): Promise<void> }).idle();
  return id;
}

test("a register's session and a signed-out caller cannot reach any export route", async () => {
  for (const [method, path] of [
    ["GET", "/export/entities"],
    ["GET", "/export/entities/sales.csv?from=2026-10-01&to=2026-10-31"],
    ["GET", "/export/archives"],
    ["POST", "/export/archives"],
    ["GET", "/export/archives/0197a000-0000-7000-8000-000000000001"],
    ["GET", "/export/archives/0197a000-0000-7000-8000-000000000001/download"],
    ["DELETE", "/export/archives/0197a000-0000-7000-8000-000000000001"],
  ] as const) {
    expect((await call(a, path, { method, till: a.till })).status, `${method} ${path} till`).toBe(
      403,
    );
    expect(
      (await call({ cookie: "", orgId: a.orgId }, path, { method })).status,
      `${method} ${path} anonymous`,
    ).toBe(401);
  }
});

test("an owner's archive downloads as one verified ZIP holding only their shop", async () => {
  const id = await makeArchive();
  const status = await json(await call(a, `/export/archives/${id}`));
  expect(status).toMatchObject({ id, status: "ready" });
  const download = await call(a, `/export/archives/${id}/download`);
  expect(download.status).toBe(200);
  expect(download.headers.get("content-type")).toBe("application/zip");
  expect(download.headers.get("content-disposition")).toMatch(
    /^attachment; filename="shopper-archive-\d{4}-\d{2}-\d{2}\.shopper"$/,
  );
  const bytes = new Uint8Array(await download.arrayBuffer());
  expect(bytes.length).toBe(Number(download.headers.get("content-length")));
  const result = await verifyArchive(bytes);
  if (!result.ok) throw new Error(result.message);
  expect(result.manifest.org.id).toBe(a.orgId);
  const all = [...readZip(bytes).values()]
    .map((value) => new TextDecoder().decode(value))
    .join("\n");
  expect(all).not.toContain(SENTINEL);
  expect(all).not.toContain(b.orgId);
  const list = await json(await call(a, "/export/archives"));
  expect(list.archives.map((row: { id: string }) => row.id)).toContain(id);
  expect(list.fingerprint).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
});

test("another shop's archive is invisible: get, download and delete all say not found", async () => {
  const theirs = await makeArchive(b);
  for (const [method, path] of [
    ["GET", `/export/archives/${theirs}`],
    ["GET", `/export/archives/${theirs}/download`],
    ["DELETE", `/export/archives/${theirs}`],
  ] as const)
    expect((await call(a, path, { method })).status, `${method} ${path}`).toBe(404);
  expect(
    (await json(await call(a, "/export/archives"))).archives.map((row: { id: string }) => row.id),
  ).not.toContain(theirs);
  expect((await call(b, `/export/archives/${theirs}`)).status).toBe(200);
});

test("a second archive is refused while one is running, and a deleted archive is gone", async () => {
  runtimeOptions().archiveExports = { start: async () => {}, send: async () => {} };
  const running = await call(a, "/export/archives", { method: "POST" });
  expect(running.status).toBe(202);
  const again = await call(a, "/export/archives", { method: "POST" });
  expect(again.status).toBe(409);
  expect(await json(again)).toMatchObject({
    error: "An archive is already being prepared.",
    code: "busy",
  });
  const { id } = await json(running);
  expect((await call(a, `/export/archives/${id}/download`)).status).toBe(409);
  expect((await call(a, `/export/archives/${id}`, { method: "DELETE" })).status).toBe(409);
  // Nothing runs it: the box restarting would start it again; here the test finishes it.
  runtimeOptions().archiveExports = archive.launcher;
  await archive.relaunch();
  await (archive.launcher as unknown as { idle(): Promise<void> }).idle();
  expect((await json(await call(a, `/export/archives/${id}`))).status).toBe("ready");
  expect((await call(a, `/export/archives/${id}`, { method: "DELETE" })).status).toBe(200);
  expect((await call(a, `/export/archives/${id}`)).status).toBe(404);
  expect((await call(a, `/export/archives/${id}/download`)).status).toBe(404);
});

test("a spreadsheet downloads as CSV and Excel with the shop's own rows and a named file", async () => {
  const csv = await call(a, "/export/entities/products.csv");
  expect(csv.status).toBe(200);
  expect(csv.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  expect(csv.headers.get("content-disposition")).toMatch(
    /filename="tenant-a-[0-9a-f]+-products\.csv"/,
  );
  expect((await csv.text()).startsWith("SKU,Name,")).toBe(true);
  const xlsx = await call(a, "/export/entities/products.xlsx");
  expect(xlsx.headers.get("content-type")).toBe(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const book = XLSX.read(new Uint8Array(await xlsx.arrayBuffer()), { type: "array" });
  expect(book.SheetNames).toEqual(["Products"]);
  const sentinel = await call(b, "/export/entities/products.csv");
  expect(await sentinel.text()).toContain(SENTINEL);
  expect(await (await call(a, "/export/entities/products.csv")).text()).not.toContain(SENTINEL);
});

test("bad requests are refused in words: an unknown entity, a missing range, too long a range, a caller's own page size", async () => {
  expect((await call(a, "/export/entities/secrets.csv")).status).toBe(400);
  expect((await call(a, "/export/entities/sales.csv")).status).toBe(400);
  const long = await call(a, "/export/entities/sales.csv?from=2025-01-01&to=2026-11-30");
  expect(long.status).toBe(400);
  expect((await json(long)).detail).toContain("at most 366 days");
});

test("the caller cannot choose the server's page size or Excel cap", async () => {
  // These are options of the function, not of the request: a query string naming them changes nothing.
  const response = await call(a, "/export/entities/products.xlsx?maxWorkbookRows=0&pageRows=1");
  expect(response.status).toBe(200);
});
