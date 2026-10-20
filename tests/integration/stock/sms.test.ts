import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { auditLog, branch, permission, role, rolePermission, stockAlert } from "@shopper/db-pg";
import { boxQueue } from "@shopper/adapters-box";
import { deliverStockAlert } from "@shopper/core/stock";
import type { Envelope } from "@shopper/ports";
import { ids } from "../../fixtures/sales/golden";
import { goldenWorld } from "../../support/sales/golden/setup";
import { appVersion, databases } from "../../support/till/server";
import { stockProduct } from "../../support/till/stock";
import { portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { send } from "../../support/stock/http";
import { sentMessages } from "../../support/stock/queue";
import { arkesel, recordedDelivery, sms } from "../../support/stock/sms";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let clerk: string;
let cashier: string;
const patchPhones = (alertPhones: unknown, cookie = clerk) =>
  send(owner.api, cookie, "PATCH", `/branches/${ids.branch}`, { alertPhones });
const deliver = (message: Envelope, attempts = 1) => {
  const recorded = recordedDelivery(message, attempts);
  return deliverStockAlert(databases().db, sms, recorded.delivery, appVersion).then(
    () => recorded.settled,
  );
};
const alertOf = async (productId: string) => {
  const [alert] = await databases()
    .db.select()
    .from(stockAlert)
    .where(eq(stockAlert.productId, productId));
  return alert!;
};
/** A low product at the golden branch, and the message raising its alert raised. */
async function raise(onHand = 1_000) {
  const productId = await stockProduct(onHand);
  const set = await send(owner.api, clerk, "PUT", "/stock/reorder", {
    branchId: ids.branch,
    productId,
    levelThousandths: 3_000,
  });
  expect(set.status).toBe(200);
  const alert = await alertOf(productId);
  const message = (await sentMessages()).find(
    (m) => (m.payload as { alertId: string }).alertId === alert.id,
  )!;
  return { productId, alert, message };
}

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  clerk = await portalMember(owner, "inventory");
  cashier = await portalMember(owner, "cashier");
  // Only owners hold branch.write; this suite lets the inventory role change alert phones.
  const { db } = databases();
  const [inventory] = await db
    .select()
    .from(role)
    .where(and(eq(role.orgId, ids.org), eq(role.name, "inventory")));
  const [write] = await db
    .select()
    .from(permission)
    .where(and(eq(permission.orgId, ids.org), eq(permission.code, "branch.write")));
  await db
    .insert(rolePermission)
    .values({ orgId: ids.org, roleId: inventory!.id, permissionId: write!.id });
});
afterAll(async () => {
  await arkesel.stop();
  await world?.local.close();
});

test("One SMS is sent per alert, with its audit row, and a redelivery sends nothing", async () => {
  expect((await patchPhones(["0241234567", "+233551234567", "233201234567"])).status).toBe(200);
  const { alert, message } = await raise();
  const before = arkesel.requests.length;
  expect(await deliver(message)).toEqual(["ack"]);
  expect(arkesel.requests).toHaveLength(before + 1);
  expect(arkesel.requests.at(-1)).toEqual({
    sender: "Shopper",
    message: "Low stock: Stock product at Main, 1 left, reorder at 3.",
    recipients: ["233241234567", "233551234567", "233201234567"],
  });
  expect((await alertOf(alert.productId)).sentAt).toBeInstanceOf(Date);
  const audits = await databases()
    .db.select()
    .from(auditLog)
    .where(and(eq(auditLog.command, "stock.alert.sent"), eq(auditLog.entityId, alert.id)));
  expect(audits).toHaveLength(1);

  expect(await deliver(message, 2)).toEqual(["ack"]);
  expect(arkesel.requests).toHaveLength(before + 1);
});

test("A negative on hand is written with a plain ASCII minus, which an SMS keeps intact", async () => {
  expect((await patchPhones(["0241234567"])).status).toBe(200);
  const { message } = await raise(-1_500);
  expect(await deliver(message)).toEqual(["ack"]);
  const text = arkesel.requests.at(-1)!.message;
  expect(text).toBe("Low stock: Stock product at Main, -1.5 left, reorder at 3.");
  expect(text).toMatch(/^[\x20-\x7e]+$/);
});

test("Two deliveries racing mark the alert sent once", async () => {
  const { alert, message } = await raise();
  await Promise.all([deliver(message), deliver(message)]);
  const audits = await databases()
    .db.select()
    .from(auditLog)
    .where(and(eq(auditLog.command, "stock.alert.sent"), eq(auditLog.entityId, alert.id)));
  expect(audits.filter((row) => (row.payload as { marked: boolean }).marked)).toHaveLength(1);
});

test("A failed send is retried, and a message that runs out of attempts dead-letters unsent", async () => {
  const { alert, message } = await raise();
  arkesel.failNext(1);
  expect(await deliver(message)).toEqual(["retry"]);
  expect((await alertOf(alert.productId)).sentAt).toBeNull();
  expect(await deliver(message, 2)).toEqual(["ack"]);
  expect((await alertOf(alert.productId)).sentAt).toBeInstanceOf(Date);

  const stuck = await raise();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  arkesel.failNext(99);
  const queue = boxQueue({ maxAttempts: 3, delayMs: 0, backoff: "constant" }, (delivery) =>
    deliverStockAlert(databases().db, sms, delivery, appVersion),
  );
  const requests = arkesel.requests.length;
  await queue.send(stuck.message);
  await queue.idle();
  arkesel.failNext(0);
  expect(log.mock.calls.some(([entry]) => entry?.event === "queue.dead_letter")).toBe(true);
  log.mockRestore();
  expect(arkesel.requests).toHaveLength(requests);
  expect((await alertOf(stuck.productId)).sentAt).toBeNull();
});

test("A cleared alert, or a branch with no phones, sends nothing", async () => {
  const cleared = await raise();
  await send(owner.api, clerk, "PUT", "/stock/reorder", {
    branchId: ids.branch,
    productId: cleared.productId,
    levelThousandths: null,
  });
  const requests = arkesel.requests.length;
  expect(await deliver(cleared.message)).toEqual(["ack"]);

  const quiet = await raise();
  expect((await patchPhones([])).status).toBe(200);
  expect(await deliver(quiet.message)).toEqual(["ack"]);
  expect(arkesel.requests).toHaveLength(requests);
  expect((await alertOf(quiet.productId)).sentAt).toBeNull();
  await patchPhones(["0241234567"]);
});

test("Alert phones are validated, capped at three and need branch.write", async () => {
  for (const bad of [
    ["12345"],
    ["0241234567", "0241234567"],
    ["0241234567", "0241234568", "0241234569", "0241234560"],
    "0241234567",
  ])
    expect((await patchPhones(bad)).status, JSON.stringify(bad)).toBe(400);
  expect((await patchPhones(["0241234567"], cashier)).status).toBe(403);
  const [saved] = await databases().db.select().from(branch).where(eq(branch.id, ids.branch));
  expect(saved!.alertPhones).toEqual(["0241234567"]);
});
