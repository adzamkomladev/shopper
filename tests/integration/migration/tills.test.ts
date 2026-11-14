// Day 42's required test. Box → cloud: tills relocate, next receipt numbers continue, fiscal sequence unbroken.
// Two registers trade on the box (one well into its second block), the owner moves the shop, and each register
// follows the relocation its next handshake hands it: the same device, now on the cloud, selling on from the very
// next receipt number in the same branch-register series that numbers its fiscal invoices. The box refuses the rest.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { buildInfo } from "@shopper/config";
import { allocateStoreSequence } from "@shopper/core";
import { relocateRegister } from "@shopper/adapters-box/till";
import * as schema from "@shopper/db-pg";
import { boxAndCloud, CLOUD, handshake, tillCall } from "../../support/migration/move";

type Receipts = {
  branchCode: string;
  deviceCode: string;
  blocks: { start: number; end: number }[];
};
let h: Awaited<ReturnType<typeof boxAndCloud>>;
// What each register sold up to on the box, and what the box had issued it.
const sold = [1500, 40];
const before: Receipts[] = [];
let boxStoreSeq: bigint;

beforeAll(async () => {
  h = await boxAndCloud();
  for (const [index, register] of h.registers.entries()) {
    await handshake(tillCall(h.box, register, register.token), 0);
    const answer = await handshake(tillCall(h.box, register, register.token), sold[index]!);
    before.push(answer.body.receipts as Receipts);
  }
  const [store] = await h.f.db.select().from(schema.store).where(eq(schema.store.id, h.f.store.id));
  boxStoreSeq = store!.lastSeq;
  await h.start();
  await h.settle();
}, 300_000);
afterAll(async () => h?.close());

test("Box → cloud: tills relocate, next receipt numbers continue, fiscal sequence unbroken", async () => {
  for (const [index, register] of h.registers.entries()) {
    const onBox = tillCall(h.box, register, register.token);
    const handed = await handshake(onBox, sold[index]!);
    expect(handed.status).toBe(200);
    // The moved box issues nothing: numbers it handed out now would be unknown to the cloud.
    expect(handed.body).not.toHaveProperty("receipts");

    const registration = await relocateRegister(
      { orgId: h.f.ctx.orgId, deviceId: register.id },
      handed.body.relocation,
      { issuer: h.issuer.publicKey, fetch: async (request) => h.cloud.fetch(request) },
    );
    expect(registration).toMatchObject({ upstream: CLOUD });
    // Same branch and register codes: the receipt and fiscal invoice numbers stay one series.
    expect(registration!.receiptCodes).toEqual({
      branchCode: before[index]!.branchCode,
      deviceCode: before[index]!.deviceCode,
    });

    const onCloud = tillCall(h.cloud, register, registration!.deviceToken);
    const resumed = await handshake(onCloud, sold[index]!);
    expect(resumed.status).toBe(200);
    // The cloud hands back exactly the blocks the register holds: it sells on from sold + 1, no reuse, no gap.
    expect(resumed.body.receipts).toEqual(before[index]);
    const next = await handshake(onCloud, before[index]!.blocks.at(-1)!.start + 10);
    const blocks = (next.body.receipts as Receipts).blocks;
    expect(blocks[0]).toEqual(before[index]!.blocks.at(-1));
    expect(blocks[1]!.start).toBe(before[index]!.blocks.at(-1)!.end + 1);

    // The box's token is not the cloud's: only the relocation gets a register in.
    expect((await handshake(tillCall(h.cloud, register, register.token), 0)).status).toBe(401);
  }

  // The store's sequence continues above everything the box numbered.
  const sequence = await h.b.db.transaction((tx) =>
    allocateStoreSequence(tx, h.f.ctx.orgId, h.f.store.id),
  );
  expect(sequence).toBe(boxStoreSeq + 1n);
  // Fiscal documents waiting on the box wait in the cloud, numbered as they were, for the cloud's lane to submit.
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

  // The box keeps refusing a register's sales: they go to the cloud from its outbox.
  const push = await tillCall(
    h.box,
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
