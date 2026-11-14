// Day 42: the box moves its shop into the cloud. Once the owner starts, the box takes no changes (its registers keep
// selling into their outboxes); the move seals, sends every file once even when the line drops mid-upload, and
// commits; then each register's next handshake hands it the relocation the cloud signed, and no new receipt numbers.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { buildInfo } from "@shopper/config";
import { verifyRelocation } from "@shopper/core/licence";
import * as schema from "@shopper/db-pg";
import { requestCloudMove } from "@shopper/export";
import { boxAndCloud, CLOUD, handshake, tillCall } from "../../support/migration/move";

let h: Awaited<ReturnType<typeof boxAndCloud>>;
const puts = new Map<string, number>();
const dropped: string[] = [];

beforeAll(async () => {
  h = await boxAndCloud(async (url, init, send) => {
    const path = url.split("/files/")[1];
    // The line drops once, on the third file: the retry must not send the first two again.
    if (path && init.method === "PUT" && puts.size === 2 && !dropped.length) {
      dropped.push(path);
      throw new Error("The connection was reset");
    }
    const response = await send(url, init);
    if (path && response.ok) puts.set(path, (puts.get(path) ?? 0) + 1);
    return response;
  });
  await h.start();
}, 300_000);
afterAll(async () => h?.close());

const till = () => tillCall(h.box, h.registers[0]!, h.registers[0]!.token);

test("from the moment the move starts the box takes no changes, from members or registers", async () => {
  const customer = await h.box.request("/customers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: v7(), name: "Ama Mensah" }),
  });
  expect(customer.status).toBe(423);
  expect(await customer.json()).toMatchObject({ error: expect.stringContaining("cloud") });
  const push = await till()("/sync/push", {
    requestId: v7(),
    protocol: buildInfo.syncProtocol,
    events: [],
    proofs: [],
  });
  expect(push.status).toBe(423);
  // A second start while one is running is refused.
  await expect(
    requestCloudMove(
      h.f.db,
      { ...h.f.ctx, actorId: h.f.userId },
      { start: async () => {} } as never,
      { cloudUrl: CLOUD },
    ),
  ).rejects.toThrow("already moving");
});

test("the move seals, sends each file once despite a dropped line, and commits", async () => {
  await h.settle();
  const [row] = await h.f.db.select().from(schema.cloudMove);
  expect(row).toMatchObject({ status: "moved", error: null, cloudUrl: CLOUD });
  expect(dropped).toHaveLength(1);
  expect([...puts.values()].every((count) => count === 1)).toBe(true);
  expect(puts.get(dropped[0]!)).toBe(1);
  expect(await h.b.db.$count(schema.sale)).toBe(await h.f.count("sale"));
  const [imported] = await h.b.db.select().from(schema.archiveImport);
  expect(imported).toMatchObject({ status: "ready", credentials: null });
});

test("a register's handshake hands over its relocation once recorded, and issues no receipt numbers", async () => {
  const register = h.registers[0]!;
  const blocks = await h.f.db.select().from(schema.receiptBlock);
  const answer = (await handshake(till(), 0)).body;
  expect(answer).not.toHaveProperty("receipts");
  expect(
    await verifyRelocation(h.issuer.publicKey, answer.relocation, {
      orgId: h.f.ctx.orgId,
      deviceId: register.id,
    }),
  ).toMatchObject({ upstream: CLOUD });
  expect(await h.f.db.select().from(schema.receiptBlock)).toEqual(blocks);
  const [row] = await h.f.db.select().from(schema.cloudMove);
  expect(row!.relocations[register.id]!.deliveredAt).toEqual(expect.any(String));
  // Asking again hands over the same message; the first hand-over is the one recorded.
  expect((await handshake(till(), 0)).body.relocation).toEqual(answer.relocation);
  const delivered = await h.f.db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.command, "migration.move.deliver"));
  expect(delivered).toHaveLength(1);
});
