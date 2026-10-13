import { afterAll, beforeAll, expect, vi } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import * as schema from "@shopper/db-pg";
import { boxAuthFlows } from "@shopper/adapters-box";
import { createLinkToken, createMaileroo } from "@shopper/auth";
import { memoryWorkflow } from "@shopper/ports";
import { postgresFixture } from "../../fixtures/postgres";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { mailerooFixture } from "./maileroo";

export const secret = "workflow registration secret with thirty two characters";
export const baseURL = "http://shopper.local";
export let db: schema.ShopperDatabase;
export let pool: Pool;
export let mail: Awaited<ReturnType<typeof mailerooFixture>>;
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
const running = new Set<string>();

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  mail = await mailerooFixture();
});
afterAll(async () => {
  for (const id of running) {
    await memoryWorkflow(id).send(id, "auth-action", { action: "completed" });
    await waitForEnd(id);
  }
  await mail?.close();
  await pool?.end();
  await fixture?.close();
});

export const seedRegistration = defineCommand({
  name: "conformance.registration",
  scope: "registration",
  async run(tx, ctx, input: { expiresAt: Date }) {
    await tx.insert(schema.registrationRequest).values({
      id: ctx.orgId,
      email: `${ctx.orgId}@example.com`,
      name: "Ama",
      shopName: "Ama Mart",
      shopCode: `ama-${ctx.orgId}`,
      verificationDigest: "fixture-digest",
      expiresAt: input.expiresAt,
    });
    return { id: ctx.orgId };
  },
  audit: (_input, result) => result,
});

export async function prepareRegistration(expired = false) {
  const id = v7();
  await seedRegistration(
    db,
    { orgId: id, appVersion: buildInfo.version },
    {
      expiresAt: new Date(Date.now() + (expired ? -1000 : 86_400_000)),
    },
  );
  return { id, purpose: "registration" as const };
}
export function launcher(now?: () => number) {
  return boxAuthFlows({
    withDatabase: (run) => run(db),
    linkSecret: secret,
    baseURL,
    now,
    mail: createMaileroo({
      apiKey: mail.apiKey,
      from: "noreply@shopper.test",
      endpoint: mail.endpoint,
    }),
  });
}
export function track(id: string) {
  running.add(id);
}
export async function stepsOf(id: string) {
  const rows = await db
    .select()
    .from(schema.registrationWorkflowStep)
    .where(eq(schema.registrationWorkflowStep.instanceId, id));
  return Object.fromEntries(rows.map((row) => [row.name, row.output]));
}
export async function waitForDelivery(id: string, attempt = 0) {
  await vi.waitFor(async () => expect(await stepsOf(id)).toHaveProperty(`delivery-${attempt}`), {
    timeout: 10000,
  });
  return (await stepsOf(id))[`delivery-${attempt}`];
}
export async function waitForEnd(id: string) {
  await vi.waitFor(
    async () => {
      const [row] = await db
        .select()
        .from(schema.registrationWorkflowRun)
        .where(eq(schema.registrationWorkflowRun.instanceId, id));
      expect(row?.status).toBe("completed");
    },
    { timeout: 10000 },
  );
  running.delete(id);
  return stepsOf(id);
}
export const tokenFor = (id: string) => createLinkToken(secret, "registration", id);
