// The store's people on the shared API, with real Better Auth sessions, over a world's database.
//   const s = await staffWorld(db, orgId, { orderFlows, queue })
//   s.owner                      -> a cookie for the shop's owner (every permission)
//   s.member(role, branchIds?)   -> a cookie for a new member holding the seeded role, limited to those branches
//   s.call(cookie, method, path, body?) -> { status, body } on the API
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { createApi } from "@shopper/api";
import { createAuth, registerOrganizationUser } from "@shopper/auth";
import * as schema from "@shopper/db-pg";
import type { Queue, WorkflowLauncher } from "@shopper/ports";

const baseURL = "http://localhost:8787";
const secret = "staff api integration secret that is at least thirty two chars";
const bootstrapToken = "staff api bootstrap token that is sufficiently long";
const password = "Shopper-test-password-123";
let ips = 0;
const headers = () => ({
  "content-type": "application/json",
  "X-Shopper-Client-IP": `198.51.100.${++ips % 250}`,
});

export async function staffWorld(
  db: schema.ShopperDatabase,
  orgId: string,
  over: { orderFlows?: WorkflowLauncher; queue?: Queue },
) {
  const auth = createAuth({ database: db, orgId, secret, baseURL, bootstrapToken });
  const signIn = async (email: string) => {
    const response = await auth.handler(
      new Request(`${baseURL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email, password }),
      }),
    );
    const cookie = (response.headers.get("set-cookie") ?? "").match(
      /(?:__Secure-)?better-auth\.session_token=[^;,]+/,
    )?.[0];
    if (!cookie) throw new Error(`Sign-in failed: ${response.status}`);
    return cookie;
  };
  const email = `${v7()}@owner.test`;
  const signup = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { ...headers(), "X-Shopper-Bootstrap-Token": bootstrapToken },
      body: JSON.stringify({ name: "Store owner", email, password }),
    }),
  );
  if (!signup.ok) throw new Error(`Owner sign-up failed: ${signup.status}`);
  const owner = await signIn(email);
  const principal = (await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: owner } }),
  ))!;
  const api = createApi({
    database: db,
    authentication: auth,
    notifications: over.queue,
    orderFlows: over.orderFlows,
  });
  const member = async (roleName: string, branchIds?: string[]) => {
    const address = `${v7()}@${roleName}.test`;
    const [row] = await db
      .select({ id: schema.role.id })
      .from(schema.role)
      .where(and(eq(schema.role.orgId, orgId), eq(schema.role.name, roleName)));
    await registerOrganizationUser(
      db,
      { orgId, actorId: principal.userId, role: "admin", appVersion: "test" },
      { name: roleName, email: address, password, roleId: row!.id },
    );
    if (branchIds) {
      const [user] = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, address));
      const [joined] = await db
        .select({ id: schema.member.id })
        .from(schema.member)
        .where(eq(schema.member.userId, user!.id));
      await db
        .insert(schema.memberBranch)
        .values(branchIds.map((branchId) => ({ orgId, memberId: joined!.id, branchId })));
    }
    return signIn(address);
  };
  const call = async (cookie: string | null, method: string, path: string, body?: unknown) => {
    const response = await api.request(path, {
      method,
      headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };
  return { owner, member, call };
}
