// Shopper staff over the KYB world: the second auth tenant is made the platform org (code `shopper`), its owner
// holds the platform permissions, and a platform cashier holds none. Importing it registers the KYB world.
import { afterAll, beforeAll } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { registerOrganizationUser, seedPlatformRoles } from "@shopper/auth";
import {
  auth,
  commandContext,
  otherAuth,
  otherContext,
  password,
  request,
  signIn,
  baseURL,
  fixture,
} from "../auth/setup";
import { blobs, cookies, db, queue } from "../kyb/support";

export * from "../kyb/support";
export { otherContext as platformContext } from "../auth/setup";

const platform = { orgSlug: "shopper" };
export let staffApi: ReturnType<typeof createApi>;
export let tenantApi: ReturnType<typeof createApi>;
export const staff = new Map<string, string>();
// The auth world shares one connection; the staff API gets a pool, so concurrent decisions really race.
let pool: Pool;
afterAll(() => pool?.end());

beforeAll(async () => {
  await db.update(schema.org).set({ slug: "shopper" }).where(eq(schema.org.id, otherContext.orgId));
  await seedPlatformRoles(db, otherContext, undefined);
  pool = new Pool({ connectionString: fixture.connectionString });
  const options = { notifications: queue, blobs, platform };
  staffApi = createApi({
    ...options,
    database: drizzle(pool, { schema }),
    authentication: otherAuth,
  });
  tenantApi = createApi({ ...options, database: db, authentication: auth });
  staff.set("reviewer", cookies.get("other")!);
  const owner = await otherAuth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("other")! } }),
  );
  const [cashier] = await db
    .select()
    .from(schema.role)
    .where(and(eq(schema.role.orgId, otherContext.orgId), eq(schema.role.name, "cashier")));
  await registerOrganizationUser(db, commandContext(otherContext.orgId, owner!), {
    name: "Platform cashier",
    email: "platform-cashier@example.com",
    password,
    roleId: cashier!.id,
  });
  staff.set("cashier", await signIn(otherAuth, "platform-cashier@example.com"));
});

export const asStaff = (path: string, method = "GET", body?: unknown, who = "reviewer") =>
  request(staffApi, staff.get(who)!, path, method, body);
