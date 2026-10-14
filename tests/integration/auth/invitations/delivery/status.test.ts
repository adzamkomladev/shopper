import { beforeAll, afterAll, expect, test, vi } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { boxAuthFlows } from "@shopper/adapters-box";
import { createInvitations, createMaileroo } from "@shopper/auth";
import {
  fixture,
  auth,
  otherAuth,
  cookies,
  roleIds,
  baseURL,
  otherContext,
  commandContext,
} from "../../setup";
import { mailerooFixture } from "../../../../support/workflows/maileroo";

let pool: Pool;
let db: schema.ShopperDatabase;
let mail: Awaited<ReturnType<typeof mailerooFixture>>;
let launcher: ReturnType<typeof boxAuthFlows>;
const ids: string[] = [];
const linkSecret = "invitation delivery secret longer than thirty two characters";
beforeAll(async () => {
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  mail = await mailerooFixture();
  launcher = boxAuthFlows({
    withDatabase: (run) => run(db),
    baseURL,
    linkSecret,
    mail: createMaileroo({
      apiKey: mail.apiKey,
      from: "noreply@shopper.test",
      endpoint: mail.endpoint,
    }),
  });
});
afterAll(async () => {
  for (const id of ids) await launcher.send(id, "auth-action", { action: "completed" });
  await vi.waitFor(async () => {
    const runs = await db.select().from(schema.workflowRun);
    expect(runs.every((run) => run.status === "completed")).toBe(true);
  });
  await mail?.close();
  await pool?.end();
});

async function delivery(id: string, attempt: number) {
  await vi.waitFor(async () => {
    const [step] = await db
      .select()
      .from(schema.workflowStep)
      .where(
        and(
          eq(schema.workflowStep.instanceId, id),
          eq(schema.workflowStep.name, `delivery-${attempt}`),
        ),
      );
    expect(step).toBeDefined();
  });
}

test("invitation lists reflect persisted failed and retried delivery outcomes within their tenant", async () => {
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  const other = await otherAuth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("other")! } }),
  );
  if (!owner || !other) throw new Error("Fixture owner is missing");
  const service = createInvitations({ database: db, linkSecret, baseURL, launcher });
  const [otherRole] = await db
    .select({ id: schema.role.id })
    .from(schema.role)
    .where(and(eq(schema.role.orgId, otherContext.orgId), eq(schema.role.name, "cashier")));
  if (!otherRole) throw new Error("Fixture role is missing");
  const foreign = await service.issue(other, {
    email: "other-delivery@example.com",
    roleId: otherRole.id,
    channel: "local",
  });
  ids.push(foreign.id);
  await delivery(foreign.id, 0);
  mail.responses.push({ status: 503, body: { success: false } });
  const held = mail.holdNext();
  let own: Awaited<ReturnType<typeof service.issue>>;
  try {
    own = await service.issue(owner, {
      email: "delivery-status@example.com",
      roleId: roleIds.get("cashier"),
      channel: "email",
    });
    ids.push(own.id);
    await held.received;
    expect(await service.list(owner)).toMatchObject([{ id: own.id, deliveryStatus: "pending" }]);
  } finally {
    held.release();
  }
  await delivery(own.id, 0);
  expect(await service.list(owner)).toMatchObject([{ id: own.id, deliveryStatus: "failed" }]);
  expect(await service.list(other)).toMatchObject([{ id: foreign.id, deliveryStatus: "sent" }]);
  await launcher.send(own.id, "auth-action", { action: "retry" });
  await delivery(own.id, 1);
  expect(await service.list(owner)).toMatchObject([{ id: own.id, deliveryStatus: "sent" }]);
  expect(mail.requests).toHaveLength(2);
});

const prepareInvite = defineCommand({
  name: "conformance.invitation.prepared",
  async run(tx, context, input: { id: string; roleId: string }) {
    const [row] = await tx
      .insert(schema.invitation)
      .values({
        id: input.id,
        orgId: context.orgId,
        organizationId: context.orgId,
        inviterId: context.actorId!,
        roleId: input.roleId,
        email: "cancelled-replay@example.com",
        channel: "email",
        tokenDigest: "fixture-digest",
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning();
    const [shop] = await tx
      .select({ slug: schema.org.slug })
      .from(schema.org)
      .where(eq(schema.org.id, context.orgId));
    if (!row || !shop) throw new Error("Invitation fixture is missing");
    return {
      active: true,
      expired: false,
      expiresAt: row.expiresAt.toISOString(),
      email: row.email,
      channel: row.channel,
      shopCode: shop.slug,
    };
  },
  audit: (_input, result) => ({ active: result.active }),
});

test("replayed invitation preparation rechecks cancellation before email", async () => {
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, {
      headers: { cookie: cookies.get("superadmin")! },
    }),
  );
  if (!owner) throw new Error("Fixture owner is missing");
  const id = v7();
  const params = { id, orgId: owner.orgId, purpose: "invitation" as const };
  const saved = await prepareInvite(
    db,
    commandContext(owner.orgId, owner),
    {
      id,
      roleId: roleIds.get("cashier")!,
    },
    {
      instanceId: id,
      businessKey: id,
      type: "invitation",
      step: "prepare-delivery-0",
      status: "waiting",
    },
  );
  ids.push(id);
  const service = createInvitations({ database: db, linkSecret, baseURL, launcher });
  await service.cancel(owner, id);
  const requestCount = mail.requests.length;
  await launcher.start(id, params);
  await vi.waitFor(async () => {
    const [end] = await db
      .select()
      .from(schema.workflowStep)
      .where(and(eq(schema.workflowStep.instanceId, id), eq(schema.workflowStep.name, "end")));
    expect(end).toBeDefined();
  });
  const steps = await db
    .select()
    .from(schema.workflowStep)
    .where(eq(schema.workflowStep.instanceId, id));
  expect(steps.find((step) => step.name === "prepare-delivery-0")?.output).toEqual(saved);
  expect(steps.find((step) => step.name === "delivery-0")?.output).toMatchObject({
    active: false,
    sent: false,
    expired: false,
  });
  const [row] = await db.select().from(schema.invitation).where(eq(schema.invitation.id, id));
  expect(row?.status).toBe("cancelled");
  expect(mail.requests).toHaveLength(requestCount);
});
