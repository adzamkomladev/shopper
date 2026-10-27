// A register asks the back office to approve a refund: the host posts only the request's own fields, and before any
// cash leaves the drawer it checks the answer with the server and holds it to the approved sale, total and one use.
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vite-plus/test";
import { refund as tillRefund, tillState } from "@shopper/db-sqlite";
import type { GoldenSale } from "../../../fixtures/sales/golden/types";
import { approvalWorld } from "../../../support/approvals/world";
import { runGolden } from "../../../support/sales/golden/run";
import { refundEvent } from "../../../support/sales/refunds";
import { api } from "../../../support/till/server";
import { startHostUpstream } from "../../../support/till/host/upstream";
import {
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../support/hardware/host";

const scenario: GoldenSale = {
  name: "remote approval",
  lines: [{ product: "standard", quantity: 3_000 }, { product: "zero" }],
  tenders: [{ kind: "cash", amount: 400_000 }],
};
let setup: Awaited<ReturnType<typeof approvalWorld>>;
let sale: NonNullable<Awaited<ReturnType<typeof runGolden>>>;
beforeAll(async () => {
  setup = await approvalWorld();
  sale = (await runGolden(setup.world, scenario, new Date()))!;
}, 300_000);
afterAll(async () => setup?.world.local.close());

let register: Register | undefined;
let printer: Printer | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  await upstream?.close();
  register = printer = upstream = undefined;
});

async function start() {
  // Approvals are served by the API with the workflow; everything else by the register's usual server.
  upstream = await startHostUpstream({
    url: api.url,
    request: async (path, init) =>
      path.startsWith("/approvals") ? setup.api.request(path, init) : api.request(path, init),
  });
  register = await startRegister({ upstream: upstream.url });
  printer = await startPrinter();
  // The first handshake learns the server's clock; until then a fresh session can read as not yet valid.
  await expect
    .poll(
      async () =>
        (await register!.fixture.database.read((tx) => tx.select().from(tillState)))[0]
          ?.clockOffsetMs,
      { timeout: 30_000 },
    )
    .not.toBeUndefined();
  await register.configure(registerSettings(printer.port));
}
const localRefunds = () => register!.fixture.database.read((tx) => tx.select().from(tillRefund));
const gross = (line: number) =>
  refundEvent(setup.world, sale, [{ line, before: 0, after: 1_000 }]).refund.totals.gross;
/** The register asks, and the owner approves in the back office. */
async function approved(amount: number) {
  const asked = await register!.ask({
    type: "approval.remote.request",
    kind: "refund",
    saleId: sale.id,
    receiptNumber: sale.receiptNumber,
    amount,
    reason: "Customer returned goods",
  });
  expect(asked).toMatchObject({ kind: "remoteApproval", approval: { status: "pending" } });
  const id = asked.approval.id as string;
  expect(await setup.decide(setup.owner.cookie, id, { decision: "approved" })).toBe(200);
  await vi.waitFor(async () =>
    expect(await register!.ask({ type: "approval.remote.status", approvalId: id })).toMatchObject({
      approval: { status: "approved" },
    }),
  );
  return id;
}
const refundOf = (line: number, approvalId: string) => ({
  type: "refund.record",
  receipt: sale.receiptNumber,
  lines: [{ lineId: sale.lines[line]!.id, quantityThousandths: 1_000 }],
  reason: "Customer returned goods",
  tender: { kind: "cash" },
  approval: { approvalId },
});

test("an approved refund goes through once with the manager as approver; the approval cannot pay out again", async () => {
  await start();
  const id = await approved(gross(0));
  const reply = await register!.ask(refundOf(0, id));
  expect(reply).toMatchObject({
    kind: "refund",
    refund: { approvalId: id, approverId: setup.owner.principal.userId },
  });
  expect((await setup.approval(id)).consumedAt).not.toBeNull();

  const posts = () => upstream!.requests.filter((r) => r.path === "/sync/refunds").length;
  const before = posts();
  expect(await register!.ask(refundOf(1, id))).toMatchObject({
    type: "error",
    code: "APPROVAL_FORBIDDEN",
    message: "This approval was already used. Ask again.",
  });
  expect(posts()).toBe(before);
  expect(await localRefunds()).toHaveLength(1);
  expect(await printer!.waitForJobs(1)).toHaveLength(1);
});

test("a refund whose total differs from the approved one is refused before the drawer opens", async () => {
  await start();
  const id = await approved(gross(0) + 100);
  expect(await register!.ask(refundOf(0, id))).toMatchObject({
    type: "error",
    code: "APPROVAL_FORBIDDEN",
    message: "The refund changed after the manager approved it. Ask again.",
  });
  expect(await localRefunds()).toEqual([]);
  expect(upstream!.requests.filter((r) => r.path === "/sync/refunds")).toEqual([]);
  expect(await printer!.jobs()).toEqual([]);
  expect((await setup.approval(id)).consumedAt).toBeNull();
});
