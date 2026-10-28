// A cloud signup from the first form to trading: the real registration service, the real auth and onboarding
// workflows on the box engine, a captured Maileroo, and the notification queue the onboarding events ride on.
import { afterAll, beforeAll, expect, vi } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { boxAuthFlows, boxOnboardingFlows, boxQueue } from "@shopper/adapters-box";
import { createLinkToken, createMaileroo, createOnboarding } from "@shopper/auth";
import { onboardingId } from "@shopper/core/onboarding";
import { deliverNotification } from "@shopper/core/notifications";
import { NOTIFICATION_RETRY, type Envelope } from "@shopper/ports";
import { postgresFixture } from "../../fixtures/postgres";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { mailerooFixture } from "../workflows/maileroo";

const secret = "onboarding workflow secret with thirty two characters";
const baseURL = "http://shopper.test";
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export let db: schema.ShopperDatabase;
export let mail: Awaited<ReturnType<typeof mailerooFixture>>;
export const delivered: Envelope[] = [];
let pool: Pool;
let fixture: Awaited<ReturnType<typeof postgresFixture>>;

const mailer = () =>
  createMaileroo({ apiKey: mail.apiKey, from: "noreply@shopper.test", endpoint: mail.endpoint });
let authFlows: ReturnType<typeof boxAuthFlows>;
let onboardingFlows: ReturnType<typeof boxOnboardingFlows>;
export const queue = boxQueue(NOTIFICATION_RETRY, async (delivery) => {
  delivered.push(delivery.message);
  await deliverNotification(
    { db, appVersion: "test", mail: mailer(), baseUrl: baseURL, onboarding: onboardingFlows },
    delivery,
  );
});

beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  mail = await mailerooFixture();
  authFlows = boxAuthFlows({
    withDatabase: (run) => run(db),
    linkSecret: secret,
    baseURL,
    mail: mailer(),
  });
  onboardingFlows = boxOnboardingFlows({
    withDatabase: (run) => run(db),
    appVersion: "test",
    queue,
    authFlows,
  });
});
afterAll(async () => {
  await mail?.close();
  await pool?.end();
  await fixture?.close();
});

export const service = () =>
  createOnboarding({
    database: db,
    linkSecret: secret,
    baseURL,
    launcher: authFlows,
    onboarding: onboardingFlows,
  });

/** Signs a shop up; `verify` and `complete` take it further, as the owner would from the emailed link. */
export async function signup() {
  const email = `${v7()}@example.com`;
  const started = await service().start({
    name: "Ama",
    email,
    shopName: "Ama Mart",
    shopCode: `ama-${v7().slice(-12)}`,
  });
  const token = await createLinkToken(secret, "registration", started.id);
  return {
    id: started.id,
    email,
    verify: () => service().verify({ id: started.id, token }),
    complete: () =>
      service().complete({ id: started.id, token, password: "onboarding-password-123" }),
  };
}

export const verificationEmails = (email: string) =>
  mail.requests.filter((sent) => sent.to.address === email && /Verify/.test(sent.subject));
export const nudgeEmails = (email: string) =>
  mail.requests.filter(
    (sent) => sent.to.address === email && /setting up|first sale/i.test(sent.subject),
  );

export async function onboardingRow(orgId: string) {
  const [row] = await db.select().from(schema.onboarding).where(eq(schema.onboarding.orgId, orgId));
  return row;
}

/** The onboarding run in the tenant chain once the shop exists, or in the registration chain before. */
export async function waitForRun(orgId: string, status: string, scope: "tenant" | "registration") {
  const runs = scope === "tenant" ? schema.workflowRun : schema.registrationWorkflowRun;
  await vi.waitFor(
    async () => {
      const [row] = await db
        .select()
        .from(runs)
        .where(and(eq(runs.orgId, orgId), eq(runs.instanceId, onboardingId(orgId))));
      expect(row?.status).toBe(status);
    },
    { timeout: 10_000 },
  );
}

// Taken before a test fakes the clock: emails cross a real socket to the captured Maileroo, which fake time never waits for.
const realTimeout = setTimeout;
const realPause = (ms: number) => new Promise((resolve) => realTimeout(resolve, ms));

/** Moves the clock, then lets the queue, both workflows and their emails settle: three quiet rounds in a row. */
export async function settle(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  // Steps in either chain count too: a slow step between two emails is not quiet.
  const activity = async () => {
    const steps = await db.execute<{ n: number }>(
      sql`SELECT (SELECT count(*) FROM registration_workflow_step) + (SELECT count(*) FROM workflow_step) AS n`,
    );
    return `${mail.requests.length}:${delivered.length}:${steps.rows[0]?.n}`;
  };
  for (let quiet = 0, round = 0, last = await activity(); quiet < 4 && round < 100; round++) {
    await realPause(60);
    await queue.idle();
    await vi.advanceTimersByTimeAsync(0);
    const now = await activity();
    quiet = now === last ? quiet + 1 : 0;
    last = now;
  }
}
