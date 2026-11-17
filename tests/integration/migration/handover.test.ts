// Day 43: the box claims the move over licence-signed requests. Only the box holding this move's licence and this move's
// sealed archive is handed the credentials and its registers' codes; its verification report archives the cloud org
// only when every table and day agrees, and only then do the registers' handshakes carry their relocation to the box.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { boxCache, boxRateLimiter } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { verifyRelocation, type Licence } from "@shopper/core/licence";
import * as schema from "@shopper/db-pg";
import {
  exportPrefix,
  importArchive,
  reconciliationReport,
  verifyArchive,
  archiveEntries,
  zipBytes,
} from "@shopper/export";
import { sha256 } from "@shopper/utils";
import { baseURL, secret } from "../../support/api/portal";
import { handshake, tillCall } from "../../support/migration/move";
import { BOX, boxIdentity, CLOUD, cloudAndBox, strayLicence } from "../../support/migration/onprem";

let h: Awaited<ReturnType<typeof cloudAndBox>>;
let identity: { key: string; licence: Licence };
let manifestSha256: string;
let archive: Uint8Array;
const cache = boxCache(":memory:");

beforeAll(async () => {
  h = await cloudAndBox();
  await h.member("owner", "POST", "/migration/onprem");
  await h.sealed();
  const box = await boxIdentity();
  const issued = await h.member("owner", "POST", "/migration/onprem/licence", {
    request: box.request,
  });
  identity = { key: box.key.privateKey, licence: (await issued.json()) as Licence };
  const [job] = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, h.f.ctx.orgId));
  manifestSha256 = await sha256(
    (await h.blobs.get(h.f.ctx.orgId, `${exportPrefix(job!.exportJobId)}/manifest.json`))!,
  );
  archive = await zipBytes(await archiveEntries(h.blobs, h.f.ctx.orgId, job!.exportJobId));
}, 300_000);
afterAll(async () => {
  cache.close();
  await h?.close();
});

const claim = (as = identity, body: unknown = { upstream: BOX, manifestSha256 }) =>
  h.signed(as, "/migration/handover/claim", body);

test("an unsigned claim, another shop's licence, or a licence the move did not issue is refused", async () => {
  const unsigned = await h.cloud.request("/migration/handover/claim", {
    method: "POST",
    body: JSON.stringify({ upstream: BOX, manifestSha256 }),
  });
  expect(unsigned.status).toBe(401);
  const elsewhere = {
    key: identity.key,
    licence: await strayLicence(h.issuer.privateKey, h.f.other.orgId, identity.licence.key),
  };
  expect((await claim(elsewhere)).status).toBe(409);
  const stray = {
    key: identity.key,
    licence: await strayLicence(h.issuer.privateKey, h.f.ctx.orgId, identity.licence.key),
  };
  expect((await claim(stray)).status).toBe(403);
  // Another archive (a newer download, a file from another shop) is not this move's.
  expect((await claim(identity, { upstream: BOX, manifestSha256: "0".repeat(64) })).status).toBe(
    409,
  );
});

test("the move's box claims it through the cloud's own routing: credentials and one code per register", async () => {
  const runtime = (request: Request) =>
    serveRuntime(request, {
      database: h.f.db,
      cache: cache.cache,
      rateLimiter: boxRateLimiter(),
      secret,
      baseURL,
      blobs: h.blobs,
      licenceSigningKey: h.issuer.privateKey,
      archiveExports: h.archiveExports,
    });
  const { signedRequest } = await import("@shopper/core/licence");
  const response = await runtime(
    await signedRequest(identity, `${CLOUD}/migration/handover/claim`, {
      method: "POST",
      body: JSON.stringify({ upstream: BOX, manifestSha256 }),
    }),
  );
  expect(response.status).toBe(200);
  // The owner's screen is routed too: asked without a session it wants one, rather than not existing.
  expect(
    (
      await runtime(
        new Request(`${CLOUD}/migration/onprem`, { headers: { "x-shopper-org": h.f.ctx.orgId } }),
      )
    ).status,
  ).toBe(401);
  const claimed = (await response.json()) as {
    credentials: { passwords: unknown[]; pins: unknown[]; sessionKey: string | null };
    codes: Record<string, { codeHash: string; usedAt: null }>;
  };
  expect(claimed.credentials.passwords).toHaveLength(1);
  expect(claimed.credentials.sessionKey).toEqual(expect.any(String));
  const devices = await h.f.db
    .select({ id: schema.device.id })
    .from(schema.device)
    .where(eq(schema.device.orgId, h.f.ctx.orgId));
  expect(Object.keys(claimed.codes).sort()).toEqual(devices.map((d) => d.id).sort());
  const [move] = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, h.f.ctx.orgId));
  expect(move).toMatchObject({ status: "claimed", boxUpstream: BOX });
  // Claimed, not yet verified: registers are not sent anywhere.
  const early = await handshake(tillCall(h.cloud, h.registers[0]!, h.registers[0]!.token), 0);
  expect(early.body).not.toHaveProperty("relocation");

  // Claiming again (a box that failed mid-import) issues fresh codes and messages.
  const again = (await (await claim()).json()) as typeof claimed;
  const register = h.registers[0]!.id;
  expect(again.codes[register]!.codeHash).not.toBe(claimed.codes[register]!.codeHash);
});

test("a report that disagrees is kept and archives nothing; one that agrees archives the org and sends the registers home", async () => {
  const claimed = (await (await claim()).json()) as {
    credentials: Parameters<typeof importArchive>[2]["credentials"];
  };
  const verified = await verifyArchive(archive);
  if (!verified.ok) throw new Error(verified.message);
  const files = (await import("@shopper/export")).readZip(archive);
  await importArchive(
    h.b.db,
    { orgId: h.f.ctx.orgId, appVersion: h.f.ctx.appVersion },
    {
      manifest: verified.manifest,
      read: async (path) => files.get(path),
      blobs: h.b.blobs,
      credentials: claimed.credentials,
    },
  );
  const auditUpTo = Number(
    (
      await h.b.db
        .select({ n: schema.auditLog.chainSeq })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.orgId, h.f.ctx.orgId))
    )
      .map((row) => Number(row.n))
      .sort((x, y) => y - x)[1],
  );
  const report = await reconciliationReport(h.b.db, h.f.ctx.orgId, { auditUpTo });

  const wrong = structuredClone(report);
  wrong.tables.device!.checksum = "f".repeat(32);
  const refused = await h.signed(identity, "/migration/handover/report", { report: wrong });
  expect(refused.status).toBe(200);
  expect(await refused.json()).toMatchObject({ ok: false });
  const [waiting] = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, h.f.ctx.orgId));
  expect(waiting!.status).toBe("claimed");
  expect(waiting!.report).toMatchObject({ ok: false });

  const accepted = await h.signed(identity, "/migration/handover/report", { report });
  const result = (await accepted.json()) as { ok: boolean; tables: { ok: boolean }[] };
  expect(result.tables.filter((row) => !row.ok)).toEqual([]);
  expect(result.ok).toBe(true);
  const [archived] = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, h.f.ctx.orgId));
  expect(archived!.status).toBe("archived");
  // Archived for good. A box that never heard the answer asks again and gets the agreed report; claiming again
  // hands it the credentials and no new codes (its registers hold theirs). Writes stay refused.
  const again = await h.signed(identity, "/migration/handover/report", { report: wrong });
  expect(await again.json()).toMatchObject({ ok: true });
  const resumed = (await (await claim()).json()) as { credentials: unknown; codes?: unknown };
  expect(resumed.credentials).toBeDefined();
  expect(resumed).not.toHaveProperty("codes");
  const [still] = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, h.f.ctx.orgId));
  expect(still!.status).toBe("archived");
  expect((await h.member("owner", "POST", "/categories", { name: "Late" })).status).toBe(423);

  for (const register of h.registers) {
    const handed = await handshake(tillCall(h.cloud, register, register.token), 0);
    expect(handed.body).not.toHaveProperty("receipts");
    const relocation = await verifyRelocation(h.issuer.publicKey, handed.body.relocation, {
      orgId: h.f.ctx.orgId,
      deviceId: register.id,
    });
    expect(relocation?.upstream).toBe(BOX);
  }
  const [delivered] = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, h.f.ctx.orgId));
  for (const register of h.registers)
    expect(delivered!.relocations[register.id]!.deliveredAt).toEqual(expect.any(String));
});
