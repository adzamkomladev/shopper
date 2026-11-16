// Day 43: a box installed with `--import` takes over a cloud shop at first boot. The wizard shows which shop the file
// holds, the owner pastes the licence the cloud issued from this box's request code, and the box claims the move,
// imports the shop and reports what arrived; the cloud archives itself only when the report agrees. A box cut off
// before the cloud heard its report runs the import again.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createBoxApp } from "@shopper/box";
import * as schema from "@shopper/db-pg";
import { archiveEntries, zipBytes } from "@shopper/export";
import { sha256 } from "@shopper/utils";
import { BOX, cloudAndBox } from "../../support/migration/onprem";

const CODE = "K7M2-Q9XP-4HWR";
let h: Awaited<ReturnType<typeof cloudAndBox>>;
let dir: string;
let box: ReturnType<typeof createBoxApp>;
let shop: string;
// The cloud as the box reaches it; `drop` loses the next call to a path, as a dropped connection would.
const drop = new Set<string>();

const call = (path: string, data?: unknown) =>
  box.fetch(
    new Request(`${BOX}${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
  );
const state = async () =>
  (await (await call("/install")).json()) as {
    needsInstall: boolean;
    licence: { request?: string };
    import?: { shop: string };
  };
const moveStatus = async () =>
  (
    await h.f.db
      .select({ status: schema.boxMove.status })
      .from(schema.boxMove)
      .where(eq(schema.boxMove.orgId, h.f.ctx.orgId))
  )[0]?.status;

beforeAll(async () => {
  h = await cloudAndBox();
  await h.member("owner", "POST", "/migration/onprem");
  await h.sealed();
  const [move] = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, h.f.ctx.orgId));
  const [org] = await h.f.db.select().from(schema.org).where(eq(schema.org.id, h.f.ctx.orgId));
  shop = org!.name;
  dir = await mkdtemp(join(tmpdir(), "box-import-"));
  await writeFile(
    join(dir, "import.shopper"),
    await zipBytes(await archiveEntries(h.blobs, h.f.ctx.orgId, move!.exportJobId)),
  );
  await writeFile(join(dir, "machine-id"), "fedcba9876543210fedcba9876543210\n");
  box = createBoxApp(
    {
      DATABASE_URL: h.b.connectionString,
      SHOPPER_AUTH_SECRET: "import-test-secret-0123456789abcdef",
      SHOPPER_AUTH_URL: BOX,
      SHOPPER_SINGLE_SHOP: "1",
      SHOPPER_SETUP_CODE_HASH: await sha256(CODE.replaceAll("-", "")),
      SHOPPER_LICENCE_DIR: join(dir, "licence"),
      SHOPPER_MACHINE_ID_FILE: join(dir, "machine-id"),
      SHOPPER_BLOBS_PATH: join(dir, "blobs"),
      SHOPPER_LICENCE_URL: "https://cloud.shopper.test",
      SHOPPER_IMPORT: join(dir, "import.shopper"),
    },
    {
      licenceIssuer: h.issuer.publicKey,
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (drop.delete(path)) throw new TypeError("fetch failed");
        return h.cloud.fetch(request);
      },
    },
  );
}, 300_000);
afterAll(async () => {
  await h?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

test("the wizard names the shop the file holds, and only importing it is offered", async () => {
  const waiting = await state();
  expect(waiting.needsInstall).toBe(true);
  expect(waiting.import).toEqual({ shop });
  const fresh = await call("/install", {
    code: CODE,
    shop: { name: "Other Mart", code: "other-mart" },
    store: { name: "Osu" },
    owner: { name: "Esi Mensah", email: "esi@example.com", password: "a long enough passphrase" },
  });
  expect(fresh.status).toBe(409);
});

test("a wrong code or a licence for another box imports nothing", async () => {
  const issued = (await (
    await h.member("owner", "POST", "/migration/onprem/licence", {
      request: Buffer.from(
        JSON.stringify({
          machine: "a".repeat(64),
          key: JSON.parse(Buffer.from((await state()).licence.request!, "base64url").toString())
            .key,
        }),
      ).toString("base64url"),
    })
  ).json()) as unknown;
  expect((await call("/install/import", { code: "AAAA-BBBB-CCCC", licence: issued })).status).toBe(
    403,
  );
  const elsewhere = await call("/install/import", { code: CODE, licence: issued });
  expect(elsewhere.status).toBe(422);
  expect(((await elsewhere.json()) as { error: string }).error).toMatch(/another machine/i);
  expect(await moveStatus()).toBe("open");
  expect((await h.b.db.select().from(schema.org)).length).toBe(0);
});

test("the box claims, imports and reports; cut off before its report, it runs again and the cloud archives", async () => {
  const issued = await h.member("owner", "POST", "/migration/onprem/licence", {
    request: (await state()).licence.request,
  });
  const licence = await issued.json();

  drop.add("/migration/handover/report");
  const cut = await call("/install/import", { code: CODE, licence });
  expect(cut.status).toBe(502);
  // The shop landed, the cloud is still waiting for the report: the wizard stays.
  expect((await h.b.db.select().from(schema.org)).map((row) => row.id)).toEqual([h.f.ctx.orgId]);
  expect(await moveStatus()).toBe("claimed");
  expect((await state()).import).toEqual({ shop });

  const done = await call("/install/import", { code: CODE, licence });
  expect(done.status).toBe(200);
  const result = (await done.json()) as { shop: string; ok: boolean; tables: { ok: boolean }[] };
  expect(result.tables.filter((row) => !row.ok)).toEqual([]);
  expect(result).toMatchObject({ shop, ok: true });
  expect(await moveStatus()).toBe("archived");
  const [arrival] = await h.b.db.select().from(schema.archiveImport);
  expect(arrival).toMatchObject({ status: "ready", report: { ok: true } });
  // Installed: the wizard is gone.
  expect((await call("/install")).status).toBe(404);
  expect((await call("/install/import", { code: CODE, licence })).status).toBe(404);
});
