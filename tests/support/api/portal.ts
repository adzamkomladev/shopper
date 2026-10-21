// Back-office callers for the golden world's server: the shared API with real Better Auth sessions.
//   portalOwner(orgId)           -> { api, cookie, principal } an owner (superadmin) signed in to that org
//   portalMember(owner, role)    -> a cookie for a new member holding the named seeded role
//   get(api, cookie, path)       -> { status, body } for GET path as that session (no cookie = anonymous)
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { createApi } from "@shopper/api";
import { createAuth, registerOrganizationUser } from "@shopper/auth";
import { role } from "@shopper/db-pg";
import { appVersion, databases } from "../till/server";
import { notifications } from "../stock/queue";

export const baseURL = "http://localhost:8787";
export const secret = "portal api integration secret that is at least thirty two chars";
const bootstrapToken = "portal api bootstrap token that is sufficiently long";
const password = "Shopper-test-password-123";
let ips = 0;
const headers = () => ({
  "content-type": "application/json",
  "X-Shopper-Client-IP": `198.51.100.${++ips}`,
});

export type Portal = Awaited<ReturnType<typeof portalOwner>>;

/** First user of an empty org signs up as its owner; in an org with users, `actorId` (an admin) registers an admin. */
export async function portalOwner(orgId: string, actorId?: string) {
  const { db } = databases();
  const auth = createAuth({ database: db, orgId, secret, baseURL, bootstrapToken });
  const email = `${v7()}@owner.test`;
  if (actorId) await register(orgId, actorId, "admin", email, "Store owner");
  else {
    const signup = await auth.handler(
      new Request(`${baseURL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { ...headers(), "X-Shopper-Bootstrap-Token": bootstrapToken },
        body: JSON.stringify({ name: "Store owner", email, password }),
      }),
    );
    if (!signup.ok) throw new Error(`Owner sign-up failed: ${signup.status}`);
  }
  const cookie = await signIn(auth, email);
  const principal = await auth.resolvePrincipal(new Request(baseURL, { headers: { cookie } }));
  return {
    api: createApi({ database: db, authentication: auth, notifications }),
    auth,
    cookie,
    principal: principal!,
  };
}

export async function portalMember(owner: Portal, roleName: string) {
  const email = `${v7()}@${roleName}.test`;
  await register(owner.principal.orgId, owner.principal.userId, roleName, email, roleName);
  return signIn(owner.auth, email);
}

async function register(
  orgId: string,
  actorId: string,
  roleName: string,
  email: string,
  name: string,
) {
  const { db } = databases();
  const { roleId } = await roleIdFor(orgId, roleName);
  await registerOrganizationUser(
    db,
    { orgId, actorId, role: "admin", appVersion },
    { name, email, password, roleId },
  );
}

export async function get(api: Portal["api"], cookie: string | null, path: string) {
  const response = await api.request(path, { headers: cookie ? { cookie } : {} });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function roleIdFor(orgId: string, name: string) {
  const { db } = databases();
  const [row] = await db
    .select({ roleId: role.id })
    .from(role)
    .where(and(eq(role.orgId, orgId), eq(role.name, name)));
  if (!row) throw new Error(`Role ${name} is not seeded`);
  return row;
}

async function signIn(auth: ReturnType<typeof createAuth>, email: string) {
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
}
