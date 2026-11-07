// Sixty days without a check-in turns the box's back office read-only; tills keep selling, and a check-in unlocks it.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v7 } from "uuid";
import { boxSequencer } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { boxLicence } from "@shopper/box";
import { generateKey, issueLicence, signedRequest } from "@shopper/core/licence";
import { sha256 } from "@shopper/utils";
import { ids } from "../../fixtures/sales/golden";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ringGolden } from "../../support/sales/golden/run";
import { portalOwner, protectOwner, type Portal } from "../../support/api/portal";
import { devices } from "../../support/till/server";
import { pushEvents } from "../../support/till/requests";

const DAY = 86_400_000;
let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let dir: string;
let issuer: Awaited<ReturnType<typeof generateKey>>;
let cloud: ReturnType<typeof createApi>;
let box: ReturnType<typeof createApi>;
let licence: ReturnType<typeof boxLicence>;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  await protectOwner(ids.org, owner);
  dir = await mkdtemp(join(tmpdir(), "shopper-licence-"));
  await writeFile(join(dir, "machine-id"), "0123456789abcdef0123456789abcdef\n");
  issuer = await generateKey();
  cloud = createApi({ licenceSigningKey: issuer.privateKey });
  const environment = {
    SHOPPER_LICENCE_DIR: dir,
    SHOPPER_MACHINE_ID_FILE: join(dir, "machine-id"),
    SHOPPER_LICENCE_URL: "https://cloud.shopper.test",
  };
  licence = boxLicence(environment, {
    issuer: issuer.publicKey,
    fetch: async (request) => cloud.fetch(request),
  })!;
  box = createApi({
    database: world.db,
    devices,
    sequencer: boxSequencer(world.db),
    authentication: owner.auth,
    licence,
  });
}, 300_000);
afterAll(async () => {
  await world?.local.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

const as = (path: string, init: RequestInit = {}) =>
  box.request(path, {
    ...init,
    headers: { cookie: owner.cookie, "content-type": "application/json", ...init.headers },
  });
const change = async () =>
  as("/customers", {
    method: "POST",
    body: JSON.stringify({ id: v7(), name: "Ama Mensah", phone: "0241234567" }),
  });

test("an unlicensed box shows the request code Shopper issues a licence from", async () => {
  const response = await as("/billing");
  expect(response.status).toBe(200);
  const body = (await response.json()).licence;
  expect(body).toMatchObject({ state: "locked", reason: "missing", request: expect.any(String) });
  const request = JSON.parse(Buffer.from(body.request, "base64url").toString());
  expect(request.machine).toBe(await sha256("0123456789abcdef0123456789abcdef"));
  // The box keeps one key: the same request code every time.
  expect((await (await as("/billing")).json()).licence.request).toBe(body.request);
  // Every member's shell reads the state for its banner.
  expect(await (await as("/billing/status")).json()).toEqual({
    readOnly: false,
    licence: { state: "locked", reason: "missing" },
  });
  expect((await box.request("/licence/checks", { method: "POST" })).status).toBe(401);
});

test("expired: the back office is read-only, the till still sells, and a check-in unlocks it", async () => {
  const request = JSON.parse(
    Buffer.from((await (await as("/billing")).json()).licence.request, "base64url").toString(),
  );
  const issued = await issueLicence(issuer.privateKey, {
    id: v7(),
    org: ids.org,
    site: "Golden Mart",
    machine: request.machine,
    key: request.key,
    terminals: 3,
    issuedAt: new Date(Date.now() - 61 * DAY).toISOString(),
    maintenanceUntil: "2027-01-01",
  });
  await writeFile(join(dir, "licence.json"), JSON.stringify(issued));
  expect((await (await as("/billing")).json()).licence).toMatchObject({
    state: "locked",
    reason: "expired",
    licence: { site: "Golden Mart", maintenanceUntil: "2027-01-01" },
  });

  const refused = await change();
  expect(refused.status).toBe(402);
  expect((await refused.json()).error).toMatch(/licence/i);
  expect((await as("/customers")).status).toBe(200);
  // Tills never lock: a sale rung up now syncs.
  const event = await ringGolden(
    world,
    tradingDay.find((s) => s.name === "manual card")!,
  );
  const pushed = await pushEvents(
    { request: async (path, init) => box.request(path, init) },
    [event],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  expect(pushed.status).toBe(200);
  expect((await pushed.json()).accepted).toHaveLength(1);

  // Check in now: a licence-signed request to the cloud brings back a confirmation the box keeps.
  const checked = await as("/licence/checks", { method: "POST" });
  expect(checked.status).toBe(200);
  expect(await checked.json()).toMatchObject({ state: "valid" });
  expect(JSON.parse(await readFile(join(dir, "confirmation.json"), "utf8"))).toMatchObject({
    licence: issued.id,
  });
  expect((await change()).status).toBe(201);
});

test("the cloud confirms only a genuine, licence-signed check-in", async () => {
  const stranger = await generateKey();
  const forged = await issueLicence(stranger.privateKey, {
    id: v7(),
    org: ids.org,
    site: "Forged",
    machine: "c".repeat(64),
    key: stranger.publicKey,
    terminals: 1,
    issuedAt: new Date().toISOString(),
    maintenanceUntil: "2027-01-01",
  });
  const url = "https://cloud.shopper.test/licence/confirmations";
  const attempt = await signedRequest({ key: stranger.privateKey, licence: forged }, url, {
    method: "POST",
    body: "{}",
  });
  expect((await cloud.fetch(attempt)).status).toBe(401);
  expect(
    (await cloud.request("/licence/confirmations", { method: "POST", body: "{}" })).status,
  ).toBe(401);
  // A host without the issuer's key answers no check-ins.
  expect((await createApi({}).fetch(attempt)).status).toBe(404);
});
