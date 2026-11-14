// Day 42: a licensed box moves its archive into the cloud over licence-signed requests. Only that shop's box may
// open the import; every file is checked as it lands and the upload resumes from what the cloud already holds; the
// commit imports the shop, applies the credentials (then forgets them) and hands each register a signed relocation.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { boxArchiveImport } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import {
  generateKey,
  issueLicence,
  signedRequest,
  verifyRelocation,
  type Licence,
} from "@shopper/core/licence";
import * as schema from "@shopper/db-pg";
import { signManifest } from "@shopper/export";
import { SECRETS } from "../../support/export/org";
import { emptyDatabase, movedArchive } from "../../support/migration/archive";

// The cloud serves its API under /api and strips it: a box signs the whole path it called.
const CLOUD = "https://cloud.shopper.test/api";
let a: Awaited<ReturnType<typeof movedArchive>>;
let b: Awaited<ReturnType<typeof emptyDatabase>>;
let issuer: Awaited<ReturnType<typeof generateKey>>;
let box: { key: string; licence: Licence };
let imports: ReturnType<typeof boxArchiveImport>;
let api: ReturnType<typeof createApi>;
let opening: string;

beforeAll(async () => {
  a = await movedArchive();
  b = await emptyDatabase();
  issuer = await generateKey();
  box = await licensed(a.context.orgId);
  imports = boxArchiveImport({ database: b.db, blobs: b.blobs });
  api = createApi({
    database: b.db,
    blobs: b.blobs,
    licenceSigningKey: issuer.privateKey,
    archiveImports: imports.launcher,
  });
  const signed = await signManifest(a.manifest, a.key.privateKey);
  opening = JSON.stringify({
    manifest: new TextDecoder().decode(signed.json),
    signature: signed.signature,
  });
});
afterAll(async () => {
  await a?.close();
  await b?.close();
});

async function licensed(org: string) {
  const key = await generateKey();
  const licence = await issueLicence(issuer.privateKey, {
    id: v7(),
    org,
    site: "Accra Mall",
    machine: "a".repeat(64),
    key: key.publicKey,
    terminals: 5,
    issuedAt: new Date().toISOString(),
    maintenanceUntil: "2027-11-14",
  });
  return { key: key.privateKey, licence };
}

/** The request as the cloud's API sees it: signed for `/api/...`, served with the prefix stripped. */
async function call(path: string, method: string, body?: string | Uint8Array, who = box) {
  const signed = await signedRequest(who, `${CLOUD}${path}`, { method, body });
  return api.fetch(new Request(signed.url.replace("/api/", "/"), signed));
}

const paths = () => [
  ...Object.values(a.manifest.tables).flatMap((table) => table.files.map((file) => file.path)),
  ...a.manifest.blobs.map((blob) => blob.path),
];

test("only this shop's licensed box may open its import, with a manifest its key signed", async () => {
  const unsigned = await api.fetch(
    new Request("https://cloud.shopper.test/migration/imports", {
      method: "POST",
      body: opening,
    }),
  );
  expect(unsigned.status).toBe(401);
  // A genuine licence, but for another shop.
  expect((await call("/migration/imports", "POST", opening, await licensed(v7()))).status).toBe(
    403,
  );
  const forged = JSON.stringify({ ...JSON.parse(opening), signature: "AAAA" });
  expect((await call("/migration/imports", "POST", forged)).status).toBe(422);
  expect(await b.db.$count(schema.archiveImport)).toBe(0);
});

test("files are checked as they land, and the upload resumes from what the cloud holds", async () => {
  const opened = await call("/migration/imports", "POST", opening);
  expect(opened.status).toBe(201);
  const { id, missing } = (await opened.json()) as { id: string; missing: string[] };
  expect(missing.sort()).toEqual(paths().sort());
  const [first, second] = paths();
  const put = (path: string, bytes: Uint8Array) =>
    call(`/migration/imports/${id}/files/${path}`, "PUT", bytes);
  expect((await put(first!, (await a.read(first!))!)).status).toBe(204);
  const flipped = (await a.read(second!))!.slice();
  flipped[0] ^= 1;
  expect((await put(second!, flipped)).status).toBe(422);
  expect((await put("tables/nope/0001.ndjson", new Uint8Array([1]))).status).toBe(404);

  // The box restarts: opening again finds the same import and only what is still missing.
  const again = (await (await call("/migration/imports", "POST", opening)).json()) as {
    id: string;
    missing: string[];
  };
  expect(again.id).toBe(id);
  expect(again.missing).not.toContain(first);
  expect(again.missing).toContain(second);
  const early = await call(`/migration/imports/${id}/commit`, "POST", JSON.stringify({}));
  expect(early.status).toBe(409);
  expect(((await early.json()) as { missing: string[] }).missing).toContain(second);
});

test("the commit imports the shop, applies then forgets the credentials, and relocates every register", async () => {
  const { id, missing } = (await (await call("/migration/imports", "POST", opening)).json()) as {
    id: string;
    missing: string[];
  };
  for (const path of missing)
    expect(
      (await call(`/migration/imports/${id}/files/${path}`, "PUT", (await a.read(path))!)).status,
    ).toBe(204);
  const credentials = {
    passwords: [{ userId: a.f.userId, password: SECRETS.password }],
    pins: [{ userId: a.f.userId, pinHash: SECRETS.pin }],
    sessionKey: SECRETS.sessionKey,
  };
  const committed = await call(
    `/migration/imports/${id}/commit`,
    "POST",
    JSON.stringify({ credentials }),
  );
  expect(committed.status).toBe(202);
  const { relocations } = (await committed.json()) as { relocations: unknown[] };
  await imports.launcher.idle?.();

  const status = (await (await call(`/migration/imports/${id}`, "GET")).json()) as {
    status: string;
  };
  expect(status).toMatchObject({ status: "ready", missing: [] });
  const devices = await a.f.db
    .select({ id: schema.device.id })
    .from(schema.device)
    .where(eq(schema.device.orgId, a.context.orgId));
  expect(relocations).toHaveLength(devices.length);
  for (const device of devices) {
    const genuine = await Promise.all(
      relocations.map((value) =>
        verifyRelocation(issuer.publicKey, value, {
          orgId: a.context.orgId,
          deviceId: device.id,
        }),
      ),
    );
    expect(genuine.filter(Boolean)).toEqual([
      expect.objectContaining({ upstream: CLOUD, deviceId: device.id }),
    ]);
  }
  const [row] = await b.db.select().from(schema.archiveImport);
  expect(row!.credentials).toBeNull();
  expect(Object.keys(row!.relocations).sort()).toEqual(devices.map((d) => d.id).sort());
  const [pin] = await b.db.select().from(schema.cashierPin);
  expect(pin!.pinHash).toBe(SECRETS.pin);
  expect(await b.db.$count(schema.sale)).toBe(await a.f.count("sale"));

  // The shop is in the cloud now: the box cannot open a second import of it.
  expect((await call("/migration/imports", "POST", opening)).status).toBe(409);
});
