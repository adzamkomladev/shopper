import { afterAll, beforeAll } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import * as apiPackage from "@shopper/api";
import { createSyncRoutes } from "@shopper/api/sync";
import { createDeviceService } from "@shopper/auth/devices";
import { boxCache, boxSequencer, openTillDatabase } from "@shopper/adapters-box";
import { recordLocalSale, provisionTillReference } from "@shopper/core/till";
import * as v from "valibot";
import { saleEvent } from "@shopper/core/schemas";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postgresFixture } from "../../fixtures/postgres";
import { config as saleConfig, ids, references } from "./sales";
import { ageSession, appVersion, context, seedServerDatabase } from "./server-data";
import { serveHono, type HttpClient } from "./http";
export type SaleEvent = v.InferOutput<typeof saleEvent>;

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: import("@shopper/db-pg").ShopperDatabase;
export let cache: ReturnType<typeof boxCache>;
let session: {
  id: string;
  orgId: string;
  deviceId: string;
  branchId: string;
  userId: string;
  roleName: string;
  issuedAt: string;
  expiresAt: string;
  permissions: string[];
  proof: string;
};
export let deviceId: string;
export let deviceToken: string;
export let api: HttpClient;
export let devices: ReturnType<typeof createDeviceService>;
export let principal: { orgId: string; userId: string; roleId: string; roleName: string };
export let sequencer: ReturnType<typeof boxSequencer>;
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
  const challenge = await devices.issueEnrollment(principal, { branchId: cashier.branchId });
  const enrolled = await devices.enroll({
    orgId: context.orgId,
    code: challenge.code,
    name: "Sync till",
  });
  await devices.assignPin(principal, { userId: principal.userId, pin: "1357" });
  const login = await devices.login({
    deviceId: enrolled.deviceId,
    deviceToken: enrolled.deviceToken,
    userId: principal.userId,
    pin: "1357",
  });
  deviceId = enrolled.deviceId;
  deviceToken = enrolled.deviceToken;
  const issuedAt = new Date("2025-12-31T16:00:00.000Z");
  const expiresAt = new Date("2026-01-01T08:00:00.000Z");
  await ageSession(db, context, { sessionId: login.id, issuedAt, expiresAt });
  session = {
    id: login.id,
    orgId: context.orgId,
    deviceId,
    branchId: cashier.branchId,
    userId: principal.userId,
    roleName: login.roleName,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    permissions: login.permissions,
    proof: login.token,
  };
  sequencer = boxSequencer(db);
  api = await serveHono(apiPackage.createApi({ database: db, devices, sequencer }));
  localDirectory = await mkdtemp(join(tmpdir(), "shopper-sync-host-"));
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

export async function recordSale(options: { lineCount?: number } = {}): Promise<{
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
      now: () => new Date("2025-12-31T23:30:00.000Z"),
    },
    session,
    {
      lines: Array.from({ length: options.lineCount ?? 1 }, () => ({
        productId: ids.product,
        quantityThousandths: 1_500,
      })),
    },
  );
  return { event, proof: session.proof, sessionId: session.id };
}

export async function hostConfiguration(
  sqlitePath: string,
  origins: string[],
  upstream = "http://127.0.0.1:3101",
  options: { freshSession?: boolean; session?: null } = {},
) {
  const hostSession =
    options.session === null
      ? null
      : options.freshSession
        ? await devices.login({
            deviceId,
            deviceToken,
            userId: principal.userId,
            pin: "1357",
          })
        : session;
  return {
    sqlitePath,
    identity: {
      orgId: context.orgId,
      storeId: saleConfig.storeId,
      branchId: ids.branch,
      deviceId,
      shopName: "Shopper test shop",
      registerName: "Register 1",
    },
    deviceToken,
    session: hostSession && {
      id: hostSession.id,
      orgId: context.orgId,
      deviceId,
      branchId: ids.branch,
      userId: principal.userId,
      roleName: "roleName" in hostSession ? hostSession.roleName : session.roleName,
      issuedAt: "issuedAt" in hostSession ? isoDate(hostSession.issuedAt) : session.issuedAt,
      expiresAt: isoDate(hostSession.expiresAt),
      permissions: "permissions" in hostSession ? hostSession.permissions : session.permissions,
      proof: "token" in hostSession ? hostSession.token : session.proof,
    },
    references,
    upstream,
    origins,
    port: 0,
  };
}

function isoDate(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

export function databases() {
  return { db, context, local };
}

export function cashierSessionProof() {
  return { id: session.id, proof: session.proof };
}
export async function resetLocalTill() {
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
}

export { appVersion, context } from "./server-data";
