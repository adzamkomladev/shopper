import { afterAll, afterEach, beforeAll, expect, test, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { hashPin } from "@shopper/auth/devices";
import { refreshApprovers } from "@shopper/core/till";
import { refund as serverRefund } from "@shopper/db-pg";
import { refund as tillRefund } from "@shopper/db-sqlite";
import type { GoldenSale } from "../../../fixtures/sales/golden/types";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { runGolden } from "../../../support/sales/golden/run";
import { api, databases } from "../../../support/till/server";
import { startHostUpstream } from "../../../support/till/host/upstream";
import {
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../support/hardware/host";

const scenario: GoldenSale = {
  name: "other register",
  lines: [{ product: "standard", quantity: 3_000 }, { product: "zero" }],
  tenders: [{ kind: "cash", amount: 400_000 }],
};
let world: Awaited<ReturnType<typeof goldenWorld>>;
let sale: NonNullable<Awaited<ReturnType<typeof runGolden>>>;
beforeAll(async () => {
  world = await goldenWorld();
  sale = (await runGolden(world, scenario))!;
});
afterAll(async () => world?.local.close());

let register: Register | undefined;
let printer: Printer | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  vi.useRealTimers();
  await register?.close();
  await printer?.stop();
  await upstream?.close();
  register = printer = upstream = undefined;
});

async function start() {
  // The sale is dated 2026-10-15; a fixed clock keeps it inside the default 30-day window.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
  upstream = await startHostUpstream(api);
  register = await startRegister({ upstream: upstream.url });
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
}
const localRefunds = () => register!.fixture.database.read((tx) => tx.select().from(tillRefund));
const saved = () =>
  databases().db.select().from(serverRefund).where(eq(serverRefund.originalSaleId, sale.id));
const request = (lineIndex: number, extra: Record<string, unknown> = {}) => ({
  type: "refund.record",
  receipt: sale.receiptNumber,
  lines: [{ lineId: sale.lines[lineIndex]!.id, quantityThousandths: 1_000 }],
  reason: "Customer returned goods",
  tender: { kind: "cash" },
  ...extra,
});

test("another register's sale is refunded online and the server accepts before the drawer opens", async () => {
  await start();
  const found = await register!.ask({ type: "sales.lookup", receipt: sale.receiptNumber });
  expect(found).toMatchObject({
    kind: "saleLookup",
    status: "found",
    purchase: { origin: "server", sale: { id: sale.id }, refunds: [] },
  });
  const reply = await register!.ask(request(0));
  expect(reply).toMatchObject({
    kind: "refund",
    origin: "server",
    refund: { originalSaleId: sale.id },
  });
  const posts = upstream!.requests.filter((r) => r.path === "/sync/refunds");
  expect(posts).toHaveLength(1);
  expect(posts[0]!.response).toMatchObject({ accepted: { id: reply.refund.id } });
  expect((await localRefunds())[0]).toMatchObject({
    origin: "server",
    acceptedAt: expect.any(String),
  });
  const [saved] = await databases()
    .db.select()
    .from(serverRefund)
    .where(eq(serverRefund.id, reply.refund.id));
  expect(saved).toBeDefined();
  const jobs = await printer!.waitForJobs(1);
  expect(jobs[0]!.page).toContain("CREDIT NOTE");
  expect(jobs[0]!.kicks).toBe(1);
});

test("offline, the till says to connect and records nothing", async () => {
  await start();
  await upstream!.close();
  upstream = undefined;
  expect(await register!.ask({ type: "sales.lookup", receipt: sale.receiptNumber })).toMatchObject({
    kind: "saleLookup",
    status: "offline",
  });
  expect(await register!.ask(request(1))).toMatchObject({
    type: "error",
    code: "OFFLINE_UNAVAILABLE",
  });
  expect(await localRefunds()).toEqual([]);
  expect(await printer!.jobs()).toEqual([]);
});

test("a server rejection records nothing and the drawer stays shut", async () => {
  await start();
  // The register trusts this manager's PIN, but the server's role grants no longer include them.
  const stale = v7();
  const { identity } = register!.fixture.config;
  await refreshApprovers(
    register!.fixture.database,
    { orgId: identity.orgId, deviceId: identity.deviceId, appVersion: "0.0.0-test" },
    {
      approvers: [
        {
          userId: stale,
          name: "Gone Manager",
          pinHash: await hashPin("2468"),
          permissions: ["refund.approve"],
        },
      ],
      at: new Date(),
    },
  );
  const reply = await register!.ask(request(1, { approval: { approverId: stale, pin: "2468" } }));
  expect(reply).toMatchObject({ type: "error", code: "INVALID_SESSION" });
  expect(await localRefunds()).toEqual([]);
  expect(await printer!.jobs()).toEqual([]);
  expect(upstream!.requests.filter((r) => r.path === "/sync/refunds")).toHaveLength(1);
});

test("a retry after a lost server reply records one refund, kicks once and the server has one", async () => {
  await start();
  const refundId = v7();
  const before = (await saved()).length;
  upstream!.dropNextRefundResponse();
  expect(await register!.ask(request(0, { refundId }))).toMatchObject({
    type: "error",
    code: "OFFLINE_UNAVAILABLE",
  });
  expect(await localRefunds()).toEqual([]);
  expect(await printer!.jobs()).toEqual([]);
  const reply = await register!.ask(request(0, { refundId }));
  expect(reply).toMatchObject({ kind: "refund", origin: "server", refund: { id: refundId } });
  const local = await localRefunds();
  expect(local).toHaveLength(1);
  expect(local[0]).toMatchObject({ id: refundId, acceptedAt: expect.any(String) });
  expect(await saved()).toHaveLength(before + 1);
  const jobs = await printer!.waitForJobs(1);
  expect(jobs).toHaveLength(1);
  expect(jobs[0]!.kicks).toBe(1);
});
