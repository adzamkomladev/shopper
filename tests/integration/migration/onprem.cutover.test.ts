// Day 43's required test. Cloud → box full cutover; verification report all green.
// Two registers trade in the cloud (one well into its second block). The owner starts the move, issues the box's
// licence from its request code, and the box installed with the archive takes the shop over at first boot: its report
// agrees on every table and every day, the cloud archives itself, and each register follows the relocation its next
// cloud handshake hands it to the box: the same device and receipt series, the next number, the same credentials.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq, inArray } from "drizzle-orm";
import { v7 } from "uuid";
import { buildInfo } from "@shopper/config";
import { allocateStoreSequence } from "@shopper/core";
import { relocateRegister } from "@shopper/adapters-box/till";
import * as schema from "@shopper/db-pg";
import { handshake, tillCall } from "../../support/migration/move";
import { BOX, cloudAndBox, toBox } from "../../support/migration/onprem";

type Receipts = {
  branchCode: string;
  deviceCode: string;
  blocks: { start: number; end: number }[];
};
let h: Awaited<ReturnType<typeof cloudAndBox>>;
let remove: (() => Promise<void>) | undefined;
const sold = [1500, 40];
const before: Receipts[] = [];
let cloudStoreSeq: bigint;
let report: { ok: boolean; tables: { table: string; ok: boolean }[]; days: { ok: boolean }[] };

beforeAll(async () => {
  h = await cloudAndBox();
  for (const [index, register] of h.registers.entries()) {
    await handshake(tillCall(h.cloud, register, register.token), 0);
    const answer = await handshake(tillCall(h.cloud, register, register.token), sold[index]!);
    before.push(answer.body.receipts as Receipts);
  }
  const [store] = await h.f.db.select().from(schema.store).where(eq(schema.store.id, h.f.store.id));
  cloudStoreSeq = store!.lastSeq;

  // The evening: the owner starts the move, and the box installed with the archive takes the shop over.
  const box = await toBox(h);
  remove = box.remove;
  expect(box.status).toBe(200);
  report = box.report;
}, 300_000);
afterAll(async () => {
  await h?.close();
  await remove?.();
});

test("Cloud → box full cutover; verification report all green", async () => {
  // Every table and every trading day agree, and the cloud org is archived read-only.
  expect(report.tables.filter((row) => !row.ok)).toEqual([]);
  expect(report.days.length).toBeGreaterThan(0);
  expect(report.days.filter((row) => !row.ok)).toEqual([]);
  expect(report.ok).toBe(true);
  const [move] = await h.f.db
    .select()
    .from(schema.boxMove)
    .where(eq(schema.boxMove.orgId, h.f.ctx.orgId));
  expect(move!.status).toBe("archived");

  for (const [index, register] of h.registers.entries()) {
    const handed = await handshake(tillCall(h.cloud, register, register.token), sold[index]!);
    expect(handed.body).not.toHaveProperty("receipts");
    // A register that has not pinned the box's CA cannot reach it yet: it asks to pin, spending nothing.
    const unpinned = await relocateRegister(
      { orgId: h.f.ctx.orgId, deviceId: register.id },
      handed.body.relocation,
      {
        issuer: h.issuer.publicKey,
        pinned: false,
        fetch: () => Promise.reject(new Error("unpinned registers do not call the box")),
      },
    );
    expect(unpinned).toEqual({ pin: BOX });
    const registration = await relocateRegister(
      { orgId: h.f.ctx.orgId, deviceId: register.id },
      handed.body.relocation,
      { issuer: h.issuer.publicKey, pinned: true, fetch: async (request) => h.box.fetch(request) },
    );
    if (!registration || "pin" in registration) throw new Error("expected a registration");
    expect(registration).toMatchObject({ upstream: BOX });
    expect(registration.receiptCodes).toEqual({
      branchCode: before[index]!.branchCode,
      deviceCode: before[index]!.deviceCode,
    });

    const onBox = tillCall(h.box, register, registration.deviceToken);
    const resumed = await handshake(onBox, sold[index]!);
    expect(resumed.status).toBe(200);
    expect(resumed.body.receipts).toEqual(before[index]);
    const next = await handshake(onBox, before[index]!.blocks.at(-1)!.start + 10);
    const blocks = (next.body.receipts as Receipts).blocks;
    expect(blocks[0]).toEqual(before[index]!.blocks.at(-1));
    expect(blocks[1]!.start).toBe(before[index]!.blocks.at(-1)!.end + 1);
    // The cloud token does not work on the box.
    expect((await handshake(tillCall(h.box, register, register.token), 0)).status).toBe(401);
  }

  const sequence = await h.b.db.transaction((tx) =>
    allocateStoreSequence(tx, h.f.ctx.orgId, h.f.store.id),
  );
  expect(sequence).toBe(cloudStoreSeq + 1n);
  const fiscal = (db: schema.ShopperDatabase) =>
    db
      .select({
        id: schema.fiscalDoc.id,
        invoice: schema.fiscalDoc.invoiceNumber,
        status: schema.fiscalDoc.status,
      })
      .from(schema.fiscalDoc)
      .where(eq(schema.fiscalDoc.orgId, h.f.ctx.orgId))
      .orderBy(schema.fiscalDoc.id);
  expect(await fiscal(h.b.db)).toEqual(await fiscal(h.f.db));
  // The owner's password and every cashier PIN arrived as the cloud held them.
  const boxed = {
    passwords: await h.b.db
      .select({ id: schema.account.id, password: schema.account.password })
      .from(schema.account)
      .orderBy(asc(schema.account.id)),
    pins: await h.b.db
      .select({ userId: schema.cashierPin.userId, pinHash: schema.cashierPin.pinHash })
      .from(schema.cashierPin)
      .orderBy(asc(schema.cashierPin.userId)),
  };
  expect(boxed.passwords.filter((row) => row.password)).not.toEqual([]);
  expect(boxed).toEqual({
    passwords: await h.f.db
      .select({ id: schema.account.id, password: schema.account.password })
      .from(schema.account)
      .where(
        inArray(
          schema.account.id,
          boxed.passwords.map((row) => row.id),
        ),
      )
      .orderBy(asc(schema.account.id)),
    pins: await h.f.db
      .select({ userId: schema.cashierPin.userId, pinHash: schema.cashierPin.pinHash })
      .from(schema.cashierPin)
      .where(eq(schema.cashierPin.orgId, h.f.ctx.orgId))
      .orderBy(asc(schema.cashierPin.userId)),
  });

  // The archived cloud keeps refusing a register's sales: they go to the box from its outbox.
  const push = await tillCall(
    h.cloud,
    h.registers[0]!,
    h.registers[0]!.token,
  )("/sync/push", {
    requestId: v7(),
    protocol: buildInfo.syncProtocol,
    receiptLastUsed: sold[0],
    events: [],
    proofs: [],
  });
  expect(push.status).toBe(423);
});
