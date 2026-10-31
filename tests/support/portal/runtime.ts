import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { boxCache, boxRateLimiter } from "@shopper/adapters-box";
import type { RuntimeOptions } from "@shopper/api/runtime";
import { serveRuntime } from "@shopper/api/runtime";
import * as schema from "@shopper/db-pg";
import { seedAuthRoles } from "@shopper/auth";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

const rateLimiter = boxRateLimiter();

export const portalOrigin = "https://portal.test";
export const portalSecret = "portal-integration-secret-more-than-32-chars";
export const portalBootstrap = "portal-bootstrap-token";
export const portalPassword = "Portal-test-password-123";

const cache = boxCache(":memory:");
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let database: RuntimeOptions["database"];
let tenants: ReturnType<typeof provisioningContext>[] = [];
let slugs: string[] = [];
// Better Auth rate-limits sign-in per client IP, so each round of shops gets its own addresses.
let round = 0;

export async function startPortalFixture() {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  database = drizzle(pool, { schema });
  await migrateDatabase(database);
  await freshPortalTenants();
}

/** Two new shops with no users, so a test can bootstrap each shop's first owner. */
export async function freshPortalTenants() {
  round += 1;
  tenants = [provisioningContext(), provisioningContext()];
  slugs = tenants.map((tenant) => `portal-${tenant.orgId.slice(-12)}`);
  for (const [index, tenant] of tenants.entries()) {
    await provisionOrg(database, tenant, { name: `Portal tenant ${index}`, slug: slugs[index] });
    await seedAuthRoles(database, tenant, undefined);
  }
}

export async function stopPortalFixture() {
  cache.close();
  await pool?.end();
  await fixture?.close();
}

export function portalOptions(index: 0 | 1): RuntimeOptions {
  return {
    database,
    cache: cache.cache,
    rateLimiter,
    secret: portalSecret,
    baseURL: portalOrigin,
    orgId: tenants[index].orgId,
    bootstrapToken: portalBootstrap,
    clientIP: `10.0.${round}.${index + 1}`,
  };
}

export function portalTenantSlug(index: 0 | 1) {
  return slugs[index];
}

export function sessionCookie(response: Response) {
  const cookie = response.headers
    .get("set-cookie")
    ?.match(/(?:__Secure-)?better-auth\.session_token=[^;,]+/)?.[0];
  if (!cookie) throw new Error("Portal sign-in did not set a Better Auth session cookie");
  return cookie;
}

export async function authRequest(index: 0 | 1, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  return import("@shopper/api/portal").then(({ servePortal }) =>
    servePortal(new Request(`${portalOrigin}${path}`, { ...init, headers }), (request) =>
      serveRuntime(request, portalOptions(index)),
    ),
  );
}
