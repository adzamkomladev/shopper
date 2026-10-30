import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { boxBlobs, boxCache, boxSequencer } from "@shopper/adapters-box";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveRuntime, type RuntimeOptions } from "@shopper/api/runtime";
import { createAuth, seedAuthRoles } from "@shopper/auth";
import { createDeviceService } from "@shopper/auth/devices";
import { createProduct, saveCategory, saveSupplier, setPrice } from "@shopper/core/catalogue";
import { createCustomer } from "@shopper/core/customers";
import { mutateManagement } from "@shopper/core/management";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { seedStock } from "../../../tooling/database/stock";
import { postgresFixture } from "../../fixtures/postgres";
import { sessionCookie } from "../portal/runtime";

export const origin = "https://tenants.test";
export const SENTINEL = "SENTINEL-B";
const bootstrapToken = "tenant-sweep-bootstrap-token";
const password = "Tenant-sweep-password-123";
// Isolation is the subject here; budgets have their own suite, so every request is allowed.
const unlimited = { limit: async () => true };
// Workflows only record that they were asked; what they would do later is not a request A can make.
const launcher = { start: async () => {}, send: async () => {} };

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
export let db: schema.ShopperDatabase;
let options: RuntimeOptions;
let blobDirectory: string;
const cache = boxCache(":memory:");

/** Two shops on one cloud runtime: `a` attacks, `b` is the shop whose data must never show. */
export async function startTenants() {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  blobDirectory = await mkdtemp(join(tmpdir(), "shopper-tenants-"));
  const storage = await boxBlobs(blobDirectory, {
    baseUrl: origin,
    secret: new Uint8Array(32).fill(9),
  });
  options = {
    database: db,
    cache: cache.cache,
    rateLimiter: unlimited,
    secret: "tenant-sweep-secret-longer-than-thirty-two-bytes",
    linkSecret: "tenant-sweep-link-secret-longer-than-thirty-two",
    baseURL: origin,
    bootstrapToken,
    sequencer: boxSequencer(db),
    // Every optional family on, so each route reaches its handler rather than a 503.
    authFlows: launcher,
    onboarding: launcher,
    kyc: launcher,
    approvals: launcher,
    priceChange: launcher,
    kyb: { banks: async () => [] },
    platform: { orgSlug: "platform" },
    publicOnboarding: true,
    blobs: storage.blobs,
    momoPayment: launcher,
    momoRefund: launcher,
    paystackSecret: "sk_test_tenant_sweep",
  };
  const [a, b] = [await tenant("a"), await tenant("b")];
  await fill(b);
  return { a: { ...a, till: await till(a, (await shop(a, "Shop A")).branch.id, "Shop A") }, b };
}

export async function stopTenants() {
  cache.close();
  if (blobDirectory) await rm(blobDirectory, { recursive: true, force: true });
  await pool?.end();
  await fixture?.close();
}

export type Tenant = Awaited<ReturnType<typeof tenant>>;

export type Till = Awaited<ReturnType<typeof till>>;

/**
 * A request to the cloud runtime as `as`'s owner, naming `org` (their own shop unless a test says otherwise). With
 * `till`, it comes from that register instead: the device token for sync, the cashier's proof for everything else.
 */
export function call(
  as: Pick<Tenant, "cookie" | "orgId">,
  path: string,
  init: { method?: string; body?: unknown; org?: string; till?: Till } = {},
) {
  const headers = new Headers({ Origin: origin, "X-Shopper-Org": init.org ?? as.orgId });
  if (!init.till) headers.set("cookie", as.cookie);
  if (init.till) {
    const sync = path.startsWith("/sync");
    headers.set("authorization", `Bearer ${sync ? init.till.deviceToken : init.till.proof}`);
    headers.set("X-Shopper-Device", init.till.deviceId);
    headers.set("x-shopper-device-token", init.till.deviceToken);
  }
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return serveRuntime(
    new Request(`${origin}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    options,
  );
}

async function tenant(name: string) {
  const context = provisioningContext();
  await provisionOrg(db, context, {
    name: `Tenant ${name}`,
    slug: `tenant-${name}-${v7().slice(-8)}`,
  });
  await seedAuthRoles(db, context, undefined);
  const email = `owner-${name}@tenants.test`;
  const auth = (path: string, extra: Record<string, string> = {}) =>
    serveRuntime(
      new Request(`${origin}/api/auth/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: origin,
          "X-Shopper-Org": context.orgId,
          ...extra,
        },
        body: JSON.stringify({ name: `Owner ${name}`, email, password }),
      }),
      options,
    );
  const signedUp = await auth("sign-up/email", { "X-Shopper-Bootstrap-Token": bootstrapToken });
  if (!signedUp.ok) throw new Error(`Owner sign-up failed: ${await signedUp.text()}`);
  const cookie = sessionCookie(await auth("sign-in/email"));
  const [owner] = await db
    .execute<{ id: string }>(sql`SELECT id FROM ${schema.user} WHERE org_id = ${context.orgId}`)
    .then((result) => result.rows);
  return { orgId: context.orgId, userId: owner!.id, cookie, context };
}

/** Gives B one of most things a shop has, each named with the sentinel, through the real commands. */
async function fill(b: Tenant) {
  const actor = { ...b.context, actorId: b.userId, role: "superadmin" };
  const { branch } = await shop(b, SENTINEL);
  const category = await saveCategory(db, actor, { data: { name: `${SENTINEL} category` } });
  const supplier = await saveSupplier(db, actor, { data: { name: `${SENTINEL} supplier` } });
  // Stock seeding sets reorder levels on four products.
  const products = [];
  for (const index of [1, 2, 3, 4])
    products.push(
      await createProduct(db, actor, {
        name: `${SENTINEL} product ${index}`,
        sku: `SENTINEL-B-${index}`,
        baseUnit: "each",
        taxClass: "standard",
        categoryId: category.id,
        supplierId: supplier.id,
        barcodes: [{ code: `600990000001${index}` }],
      }),
    );
  const product = products[0]!;
  await setPrice(db, actor, { productId: product.id, data: { amount: 12_500 } });
  await createCustomer(db, actor, {
    customer: { id: v7(), name: `${SENTINEL} customer`, phone: "0244000111" },
  });
  await seedStock(db, actor, branch.id);
  await till(b, branch.id, SENTINEL);
}

async function shop(t: Tenant, name: string) {
  const actor = { ...t.context, actorId: t.userId, role: "superadmin" };
  const store = await mutateManagement(db, actor, {
    kind: "store",
    action: "create",
    data: { name: `${name} store` },
  });
  const branch = await mutateManagement(db, actor, {
    kind: "branch",
    action: "create",
    data: { name: `${name} branch`, storeId: store.id },
  });
  return { store, branch };
}

/** A register enrolled on the branch with the owner signed in on it by PIN. */
async function till(t: Tenant, branchId: string, name: string) {
  const devices = createDeviceService(db, cache.cache, t.context.appVersion, t.orgId);
  const principal = (await createAuth({
    database: db,
    orgId: t.orgId,
    secret: options.secret,
    baseURL: origin,
  }).resolvePrincipal(new Request(origin, { headers: { cookie: t.cookie } })))!;
  const issued = await devices.issueEnrollment(principal, { branchId });
  const enrolled = await devices.enroll({
    orgId: t.orgId,
    code: issued.code,
    name: `${name} till`,
  });
  await devices.assignPin(principal, { userId: t.userId, pin: "2468" });
  const login = await devices.login({
    deviceId: enrolled.deviceId,
    deviceToken: enrolled.deviceToken,
    userId: t.userId,
    pin: "2468",
  });
  return {
    deviceId: enrolled.deviceId,
    deviceToken: enrolled.deviceToken,
    sessionId: login.id,
    proof: login.token,
    // Where the till's own events say they come from.
    orgId: t.orgId,
    userId: t.userId,
    storeId: enrolled.storeId,
    branchId,
  };
}
