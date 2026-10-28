import { afterEach, expect, test } from "vite-plus/test";
import { and, eq, inArray } from "drizzle-orm";
import { hashPassword } from "../../../support/auth/password";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { boxSequencer } from "@shopper/adapters-box";
import { api, databases, devices, principal, routeFactory } from "../../../support/till/server";
import { serveHono, type HttpClient } from "../../../support/till/http";
import { createHostFixture } from "../../../support/till/host/fixture";
import { startHostUpstream } from "../../../support/till/host/upstream";
import {
  expectConverged,
  sell,
  waitForDrained,
  waitForStatus,
} from "../../../support/till/host/chaos";

const email = "sync-cashier@test.invalid";
const password = "chaos day password";
const minutes = (count: number) => count * 60_000;

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
let shifted: HttpClient | undefined;
afterEach(async () => {
  await fixture?.close();
  await upstream?.close();
  await shifted?.close();
  fixture = upstream = shifted = undefined;
});

test("24 h offline with 2,000 sales: offline sign-ins keep the register selling and every sale converges", async () => {
  const { db } = databases();
  await setPassword(db, databases().context, { userId: principal.userId, password });
  // The sync routes keep the same clock as the register, so a sale made "24 h later" is not in the server's future.
  let elapsedMs = 0;
  shifted = await serveHono(
    routeFactory({
      database: db,
      devices,
      sequencer: boxSequencer(db),
      now: () => Date.now() + elapsedMs,
    }),
  );
  const sync = shifted;
  upstream = await startHostUpstream({
    url: api.url,
    request: (path, init) => (path.startsWith("/sync") ? sync : api).request(path, init),
  });
  fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
  const productId = fixture.config.references.products[0].id;
  const host = await fixture.start(fixture.config, { clockOffsetMs: 0 });
  await waitForStatus(host, (status) => Number(status.receiptsLeft) > 0, 30_000);
  // An online sign-in caches the password verifier the register checks offline.
  expect(await host.request({ type: "session.signIn", email, password })).toMatchObject({
    status: { user: { offline: false } },
  });

  upstream.cut();
  const refusals: { step: number; message: unknown }[] = [];
  // Forty steps of 36 minutes, fifty sales each: a full day, across midnight and two session expiries.
  for (let step = 0; step < 40; step++) {
    elapsedMs = step * minutes(36);
    await host.setClock(elapsedMs);
    const first = await host.request({
      type: "recordSale",
      input: { lines: [{ productId, quantityThousandths: 1_000 }] },
    });
    if (first.type === "error") {
      // The session ran out: the cashier signs in again, offline, and keeps selling.
      expect(await host.request({ type: "session.signIn", email, password })).toMatchObject({
        status: { user: { offline: true, permissions: expect.arrayContaining(["sale.create"]) } },
      });
      refusals.push({ step, message: (first as { message?: unknown }).message });
      await sell(host, productId, 50);
    } else await sell(host, productId, 49);
  }
  // Exactly the two steps past an expiry: the server session at 8 h, the first offline one at 16 h 24.
  expect(
    refusals.map((refusal) => refusal.step),
    JSON.stringify(refusals),
  ).toEqual([14, 28]);
  expect(await fixture.queued()).toHaveLength(2_000);

  elapsedMs += minutes(36);
  await host.setClock(elapsedMs);
  upstream.restore();
  // Sync now answers once the whole backlog has gone up; the outbox draining is what matters here.
  void host.request({ type: "retry" }, 600_000).catch(() => undefined);
  await waitForDrained(host, 600_000);
  await expectConverged(fixture);

  const stored = await db
    .select({ sessionId: schema.sale.sessionId })
    .from(schema.sale)
    .where(eq(schema.sale.deviceId, fixture.config.identity.deviceId));
  expect(stored).toHaveLength(2_000);
  const sessionIds = [...new Set(stored.map((row) => row.sessionId))];
  expect(sessionIds).toHaveLength(3);
  const sessions = await db
    .select()
    .from(schema.cashierSession)
    .where(inArray(schema.cashierSession.id, sessionIds));
  const online = sessions.filter((row) => row.parentSessionId === null);
  expect(online).toHaveLength(1);
  const offline = sessions.filter((row) => row.parentSessionId === online[0]!.id);
  expect(offline).toHaveLength(2);
  for (const row of offline) {
    expect(row.expiresAt.valueOf() - row.issuedAt.valueOf()).toBeLessThanOrEqual(8 * 3_600_000);
    expect(row.userId).toBe(principal.userId);
  }
  // Each sale renders its receipt PDF on the register: 2,000 of them back to back take about eight minutes.
}, 1_200_000);

const setPassword = defineCommand({
  name: "sync.test.cashier-password",
  async run(tx, ctx, input: { userId: string; password: string }) {
    await tx
      .delete(schema.account)
      .where(and(eq(schema.account.orgId, ctx.orgId), eq(schema.account.userId, input.userId)));
    await tx.insert(schema.account).values({
      orgId: ctx.orgId,
      userId: input.userId,
      accountId: input.userId,
      providerId: "credential",
      password: await hashPassword(input.password),
    });
    return {};
  },
  audit: () => ({}),
});
