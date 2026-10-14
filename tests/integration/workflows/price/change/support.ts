import { v7 } from "uuid";
// Shared setup for the scheduled price change suites: a launcher with its own pool, real short windows.
import { afterAll, beforeAll, expect, vi } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shopper/db-pg";
import { boxPriceChange, boxRealtime } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import type { Envelope, WorkflowLauncher } from "@shopper/ports";
import {
  allAuditRows,
  call as callWithoutLauncher,
  context,
  createProduct,
  postOk,
  unique,
} from "../../../catalogue/support";
import { auth, db, fixture, request, cookies } from "../../../auth/setup";

export { callWithoutLauncher, context, createProduct, postOk, db, unique };
export { expectChainValid } from "../../../catalogue/support";
export const realtime = boxRealtime();
let pool: Pool;
let launchingApi: ReturnType<typeof createApi>;
export let launcher: WorkflowLauncher;
const subscriptions: { close(): Promise<void> }[] = [];

beforeAll(() => {
  pool = new Pool({ connectionString: fixture.connectionString });
  const priceChange = boxPriceChange({ database: drizzle(pool, { schema }), realtime });
  launcher = priceChange.launcher;
  launchingApi = createApi({
    database: db,
    authentication: auth,
    priceChange: priceChange.launcher,
  });
});
afterAll(async () => {
  await Promise.all(subscriptions.map((subscription) => subscription.close()));
  await pool?.end();
});

export const call = (path: string, method = "GET", body?: unknown, role = "superadmin") =>
  request(launchingApi, cookies.get(role)!, path, method, body);

/** Records every envelope a device on this store receives, from the beginning. */
export async function watch(orgId: string, storeId: string) {
  const messages: Envelope[] = [];
  subscriptions.push(
    await realtime.subscribe(orgId, storeId, v7(), "0", async (message) => {
      messages.push(message);
    }),
  );
  return messages;
}
export const phases = (messages: Envelope[]) =>
  messages.map((message) => (message.payload as { phase: string }).phase);

export const newStore = async () => (await postOk("/stores", { name: unique("Window store") })).id;

export type Scheduled = {
  price: {
    id: string;
    branchId: string | null;
    amount: number;
    validFrom: string;
    validTo: string;
  };
  workflowId: string;
  startsAt: string;
  endsAt: string;
};
/** Schedule a price that starts `startMs` from now and lasts `windowMs`. */
export async function schedule(
  productId: string,
  extra: Record<string, unknown> = {},
  { startMs = 150, windowMs = 450, role = "superadmin" } = {},
) {
  const startsAt = new Date(Date.now() + startMs).toISOString();
  const endsAt = new Date(Date.now() + startMs + windowMs).toISOString();
  const response = await call(
    `/products/${productId}/prices/schedule`,
    "POST",
    { amount: 7000, startsAt, endsAt, reason: "Weekend promotion", ...extra },
    role,
  );
  return { response, startsAt, endsAt };
}
export async function scheduleOk(productId: string, extra: Record<string, unknown> = {}) {
  const { response, startsAt, endsAt } = await schedule(productId, extra);
  expect(response.status).toBe(201);
  return {
    ...((await response.json()) as Omit<Scheduled, "startsAt" | "endsAt">),
    startsAt,
    endsAt,
  };
}

export const runOf = async (workflowId: string) =>
  (
    await db
      .select()
      .from(schema.workflowRun)
      .where(
        and(
          eq(schema.workflowRun.orgId, context.orgId),
          eq(schema.workflowRun.instanceId, workflowId),
        ),
      )
  )[0];
export const waitForRun = (workflowId: string, status: string) =>
  vi.waitFor(async () => expect(await runOf(workflowId)).toMatchObject({ status }), {
    timeout: 5000,
    interval: 25,
  });
export const waitForPhases = (messages: Envelope[], expected: string[]) =>
  vi.waitFor(() => expect(phases(messages)).toEqual(expected), { timeout: 5000, interval: 25 });

export const auditFor = async (command: string, entityId: string) =>
  (await allAuditRows()).filter((row) => row.command === command && row.entityId === entityId);
