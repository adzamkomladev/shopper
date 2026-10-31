import { afterAll, beforeAll } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import * as apiPackage from "@shopper/api";
import { createSyncRoutes } from "@shopper/api/sync";
import { createDeviceService } from "@shopper/auth/devices";
import { boxBlobs, boxCache, boxSequencer, openTillDatabase } from "@shopper/adapters-box";
import { recordLocalSale, provisionTillReference } from "@shopper/core/till";
import * as v from "valibot";
import { saleEvent, tillReceiptCodes } from "@shopper/core/schemas";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postgresFixture } from "../../fixtures/postgres";
import { config as saleConfig, ids, references } from "./sales";
import { appVersion, context, seedServerDatabase } from "./server/data";
import { serveHono, type HttpClient } from "./http";
import { enrollFixtureTill } from "./enrollment";
import { insertOpenShift } from "./shifts";
import { notifications } from "../stock/queue";
import { lane } from "../fiscal/lane";
import { e2eRun } from "../../../tooling/e2e/run";
export type SaleEvent = v.InferOutput<typeof saleEvent>;

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: import("@shopper/db-pg").ShopperDatabase;
export let cache: ReturnType<typeof boxCache>;
let session: Awaited<ReturnType<typeof enrollFixtureTill>>["session"];
export let deviceId: string;
export let deviceToken: string;
let receiptCodes: v.InferOutput<typeof tillReceiptCodes>;
export let api: HttpClient;
export let devices: ReturnType<typeof createDeviceService>;
export let principal: { orgId: string; userId: string; roleId: string; roleName: string };
export let sequencer: ReturnType<typeof boxSequencer>;
export let blobs: Awaited<ReturnType<typeof boxBlobs>>["blobs"];
let local: Awaited<ReturnType<typeof openTillDatabase>>;
let localDirectory: string;
export const routeFactory = createSyncRoutes;

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  const cashier = await seedServerDatabase(db);
  cache = boxCache(":memory:");
  devices = createDeviceService(db, cache.cache, appVersion, context.orgId);
  principal = {
    orgId: context.orgId,
    userId: cashier.userId,
    roleId: cashier.roleId,
    roleName: "cashier",
  };
  await devices.assignPin(principal, { userId: principal.userId, pin: "1357" });
  await renewTillEnrollment();
  sequencer = boxSequencer(db);
  localDirectory = await mkdtemp(join(tmpdir(), "shopper-sync-host-"));
  const storage = await boxBlobs(join(localDirectory, "blobs"), {
    baseUrl: "http://127.0.0.1",
    secret: new Uint8Array(32).fill(7),
  });
  blobs = storage.blobs;
  const app = apiPackage.createApi({
    database: db,
    devices,
    sequencer,
    blobs,
    notifications,
    lane,
  });
  const orgs = apiPackage.orgRoutes({ database: db });
  // The runtime serves the public shop-code lookup beside the API, as here.
  api = await serveHono({
    fetch: (request) =>
      new URL(request.url).pathname.startsWith("/orgs/") ? orgs.fetch(request) : app.fetch(request),
  });
  local = openTillDatabase(join(localDirectory, "till.sqlite"));
  await provisionReferences(cashier.branchId);
});

afterAll(async () => {
  await local?.close();
  await api?.close();
  if (localDirectory) await rm(localDirectory, { recursive: true, force: true });
  cache?.close();
  await pool?.end();
  await fixture?.close();
});

export async function recordSale(
  options: {
    lineCount?: number;
    session?: typeof session & { parentSessionId?: string | null };
    at?: string;
  } = {},
): Promise<{
  event: SaleEvent;
  proof: string;
  sessionId: string;
}> {
  const event = await recordLocalSale(
    local,
    {
      ...saleConfig,
      orgId: context.orgId,
      deviceId,
      receiptCodes,
      now: () => new Date(options.at ?? "2025-12-31T23:30:00.000Z"),
    },
    options.session ?? session,
    {
      lines: Array.from({ length: options.lineCount ?? 1 }, () => ({
        productId: ids.product,
        quantityThousandths: 1_500,
      })),
    },
  );
  const used = options.session ?? session;
  return { event, proof: used.proof, sessionId: used.id };
}

export type FixtureTill = Awaited<ReturnType<typeof enrollFixtureTill>>;

export async function hostConfiguration(
  sqlitePath: string,
  origins: string[],
  upstream = `http://127.0.0.1:${e2eRun.port(3101)}`,
  options: { freshSession?: boolean; session?: null; till?: FixtureTill } = {},
) {
  const till = options.till ?? { deviceId, deviceToken, receiptCodes, session };
  const hostSession =
    options.session === null
      ? null
      : options.freshSession
        ? await devices.login({
            deviceId: till.deviceId,
            deviceToken: till.deviceToken,
            userId: principal.userId,
            pin: "1357",
          })
        : till.session;
  return {
    sqlitePath,
    plaintext: true as const,
    identity: {
      orgId: context.orgId,
      storeId: saleConfig.storeId,
      branchId: ids.branch,
      deviceId: till.deviceId,
      shopName: "Shopper test shop",
      registerName: "Register 1",
    },
    deviceToken: till.deviceToken,
    session: hostSession && {
      id: hostSession.id,
      orgId: context.orgId,
      deviceId: till.deviceId,
      branchId: ids.branch,
      userId: principal.userId,
      roleName: "roleName" in hostSession ? hostSession.roleName : till.session.roleName,
      issuedAt: "issuedAt" in hostSession ? isoDate(hostSession.issuedAt) : till.session.issuedAt,
      expiresAt: isoDate(hostSession.expiresAt),
      permissions:
        "permissions" in hostSession ? hostSession.permissions : till.session.permissions,
      proof: "token" in hostSession ? hostSession.token : till.session.proof,
    },
    references,
    receiptCodes: till.receiptCodes,
    upstream,
    origins,
    port: 0,
  };
}

/** Enrols another register on the same branch without replacing the suite's main till. */
export function enrollAnotherTill() {
  return enrollFixtureTill(db, devices, principal);
}

function isoDate(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

export function databases() {
  return { db, context, local };
}

export function databaseConnectionString() {
  return fixture.connectionString;
}

/** The fixture till's cashier session, as the register stores it. */
export function fixtureSession() {
  return session;
}
export function cashierSessionProof() {
  return { id: session.id, proof: session.proof };
}
export async function renewTillEnrollment() {
  const enrolled = await enrollFixtureTill(db, devices, principal);
  ({ deviceId, deviceToken, receiptCodes, session } = enrolled);
}
export async function resetLocalTill() {
  await renewTillEnrollment();
  await local.close();
  if (localDirectory) await rm(localDirectory, { recursive: true, force: true });
  localDirectory = await mkdtemp(join(tmpdir(), "shopper-sync-host-"));
  local = openTillDatabase(join(localDirectory, "till.sqlite"));
  await provisionReferences(ids.branch);
}
async function provisionReferences(branchId: string) {
  await provisionTillReference(
    local,
    {
      orgId: context.orgId,
      actorId: principal.userId,
      role: principal.roleName,
      deviceId,
      branchId,
      appVersion,
    },
    references,
  );
  // The fixture register may sell: an open shift, inserted directly (no audit row).
  await insertOpenShift(local, {
    orgId: context.orgId,
    deviceId,
    branchId,
    storeId: saleConfig.storeId,
    openedBy: principal.userId,
    openedSessionId: session.id,
  });
}

export { appVersion, context, syncProtocol } from "./server/data";
