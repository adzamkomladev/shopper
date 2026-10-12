import { test, expect, beforeAll, afterAll } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import * as authModule from "@shopper/auth";
import {
  fixture,
  auth,
  cookies,
  roleIds,
  context,
  password,
  commandContext,
  baseURL,
  request,
} from "../setup";
import { authLauncherFixture } from "../../../support/workflows/fixture";
let workflows: ReturnType<typeof authLauncherFixture>;
let db: schema.ShopperDatabase;
const linkSecret = "invitation secret that is at least thirty two characters";
beforeAll(() => {
  workflows = authLauncherFixture(fixture.connectionString, { linkSecret, baseURL });
  db = workflows.database;
});
afterAll(async () => {
  await workflows?.close();
});
const service = () =>
  authModule.createInvitations({
    database: db,
    linkSecret,
    baseURL,
    launcher: workflows.launcher,
  });
async function principal(name = "superadmin") {
  const p = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get(name)! } }),
  );
  if (!p) throw new Error("No principal");
  return p;
}
function setupToken(link: string) {
  return new URL(link).searchParams.get("token")!;
}

test("local links preview safely, create only the requested staff role and do not verify email", async () => {
  const owner = await principal();
  const invite = await service().issue(owner, {
    email: "lan-new@example.com",
    roleId: roleIds.get("cashier"),
    channel: "local",
  });
  const token = setupToken(invite.setupLink!);
  const preview = await service().preview(invite.id, token);
  expect(preview.roleId).toBe(roleIds.get("cashier"));
  expect(preview.existingAccount).toBe(false);
  const result = await service().accept(invite.id, { token, name: "LAN cashier", password });
  const [staff] = await db
    .select()
    .from(schema.user)
    .where(and(eq(schema.user.orgId, context.orgId), eq(schema.user.id, result.userId)));
  expect(staff?.emailVerified).toBe(false);
  const [membership] = await db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, result.userId));
  expect(membership?.roleId).toBe(roleIds.get("cashier"));
  await expect(service().accept(invite.id, { token, name: "Again", password })).rejects.toThrow(
    "link",
  );
});

test("reissue cancels the old link, cancellation and permission ceilings are enforced", async () => {
  const owner = await principal();
  const item = await service().issue(owner, {
    email: "replace@example.com",
    roleId: roleIds.get("cashier"),
    channel: "local",
  });
  const next = await service().reissue(owner, item.id);
  await expect(service().preview(item.id, setupToken(item.setupLink!))).rejects.toThrow("link");
  await service().cancel(owner, next.id);
  await expect(service().preview(next.id, setupToken(next.setupLink!))).rejects.toThrow("link");
  await expect(
    service().issue(await principal("admin"), {
      email: "escalate@example.com",
      roleId: roleIds.get("superadmin"),
      channel: "local",
    }),
  ).rejects.toThrow();
});

test("existing credentials require the matching authenticated account and never change password", async () => {
  const owner = await principal();
  const invite = await service().issue(owner, {
    email: "accountant@example.com",
    roleId: roleIds.get("cashier"),
    channel: "local",
  });
  const token = setupToken(invite.setupLink!);
  expect((await service().preview(invite.id, token)).existingAccount).toBe(true);
  await expect(service().accept(invite.id, { token, name: "New", password })).rejects.toThrow(
    "Sign in",
  );
  const existing = await principal("accountant");
  const before = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.userId, existing.userId));
  await service().accept(invite.id, { token }, existing);
  const after = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.userId, existing.userId));
  expect(after[0]?.password).toBe(before[0]?.password);
});

test("concurrent invitation acceptance consumes the link exactly once", async () => {
  const invite = await service().issue(await principal(), {
    email: "concurrent-staff@example.com",
    roleId: roleIds.get("cashier"),
    channel: "local",
  });
  const input = { token: setupToken(invite.setupLink!), name: "Concurrent cashier", password };
  const results = await Promise.allSettled([
    service().accept(invite.id, input),
    service().accept(invite.id, input),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  const users = await db
    .select()
    .from(schema.user)
    .where(
      and(
        eq(schema.user.orgId, context.orgId),
        eq(schema.user.email, "concurrent-staff@example.com"),
      ),
    );
  expect(users).toHaveLength(1);
});

test("acceptance rechecks inviter authority after a demotion", async () => {
  const owner = await principal();
  const inviter = await principal("admin");
  const invite = await service().issue(inviter, {
    email: "demoted@example.com",
    roleId: roleIds.get("cashier"),
    channel: "local",
  });
  await authModule.assignMemberRole(db, commandContext(context.orgId, owner), {
    userId: inviter.userId,
    roleId: roleIds.get("accountant"),
  });
  await expect(
    service().accept(invite.id, {
      token: setupToken(invite.setupLink!),
      name: "Cashier",
      password,
    }),
  ).rejects.toThrow();
  await authModule.assignMemberRole(db, commandContext(context.orgId, owner), {
    userId: inviter.userId,
    roleId: roleIds.get("admin"),
  });
});

test("invitation HTTP routes enforce management permissions and allow public previews and atomic staff acceptance", async () => {
  const app = createApi({ database: db, authentication: auth, invitations: service() });
  const denied = await request(app, cookies.get("cashier")!, "/invitations", "POST", {
    email: "http-denied@example.com",
    roleId: roleIds.get("cashier"),
    channel: "local",
  });
  expect(denied.status).toBe(403);
  const issued = await request(app, cookies.get("superadmin")!, "/invitations", "POST", {
    email: "http-staff@example.com",
    roleId: roleIds.get("cashier"),
    channel: "local",
  });
  expect(issued.status).toBe(201);
  const item = await issued.json();
  const token = setupToken(item.setupLink);
  expect((await app.request(`/invitations/${item.id}/preview?token=${token}`)).status).toBe(200);
  expect((await request(app, cookies.get("superadmin")!, "/invitations")).status).toBe(200);
  const accepted = await app.request(`/invitations/${item.id}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, name: "HTTP staff", password }),
  });
  expect(accepted.status).toBe(200);
  expect((await app.request(`/invitations/${item.id}/preview?token=${token}`)).status).toBe(410);
  const audits = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId));
  const steps = await db
    .select()
    .from(schema.workflowStep)
    .where(eq(schema.workflowStep.orgId, context.orgId));
  expect(JSON.stringify({ audits, steps })).not.toContain(token);
  expect(JSON.stringify({ audits, steps })).not.toContain(password);
});
