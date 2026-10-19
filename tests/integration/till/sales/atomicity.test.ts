import { sql } from "drizzle-orm";
import { expect, test } from "vite-plus/test";
import { openTillDatabase } from "@shopper/adapters-box/till";
import { hostSession, localSale, outbox, saleLine, tillAudit, tillState } from "@shopper/db-sqlite";
import { recordLocalSale, provisionTillReference } from "@shopper/core/till";
import {
  config,
  context,
  foreignProduct,
  ids,
  references,
  session,
  withDatabase,
} from "../../../support/till/sales";
import { insertOpenShift } from "../../../support/till/shifts";

const lines = [{ productId: ids.product, quantityThousandths: 1_000 }];

async function snapshot(db: ReturnType<typeof openTillDatabase>) {
  return db.read(async (tx) => ({
    sales: await tx.select().from(localSale),
    lines: await tx.select().from(saleLine),
    queue: await tx.select().from(outbox),
    state: await tx.select().from(tillState),
    sessions: await tx.select().from(hostSession),
    audits: await tx.select().from(tillAudit),
  }));
}

async function seed(db: ReturnType<typeof openTillDatabase>) {
  await provisionTillReference(db, context, references);
  await insertOpenShift(db);
}

test("rolls back sale, line, proof, counter, outbox and audit when the outbox write fails", async () => {
  await withDatabase(async (path) => {
    const db = openTillDatabase(path);
    try {
      await seed(db);
      const before = await snapshot(db);
      await db.read((tx) =>
        tx.run(
          sql.raw(`CREATE TRIGGER reject_outbox BEFORE INSERT ON outbox
          BEGIN SELECT RAISE(ABORT, 'injected outbox failure'); END`),
        ),
      );
      await expect(recordLocalSale(db, config, session, { lines })).rejects.toMatchObject({
        cause: { message: "injected outbox failure" },
      });
      await db.read((tx) => tx.run(sql.raw("DROP TRIGGER reject_outbox")));
      expect(await snapshot(db)).toEqual(before);

      const event = await recordLocalSale(db, config, session, { lines });
      const queued = await db.read((tx) => tx.select({ localSeq: outbox.localSeq }).from(outbox));
      expect(queued).toEqual([{ localSeq: 1 }]);
      expect((await snapshot(db)).sessions).toHaveLength(1);
      expect(event.sale.localId).toBe(event.sale.id);
    } finally {
      await db.close();
    }
  });
});

test("rejects invalid session, tenant references, fractional quantities and spoofed sale fields", async () => {
  await withDatabase(async (path) => {
    const db = openTillDatabase(path);
    try {
      await seed(db);
      const before = await snapshot(db);
      await expect(
        recordLocalSale(db, config, { ...session, permissions: [] }, { lines }),
      ).rejects.toThrow(/permission|authorized/i);
      await expect(
        recordLocalSale(db, config, { ...session, orgId: ids.otherOrg }, { lines }),
      ).rejects.toThrow(/scope|tenant|session/i);
      await expect(
        provisionTillReference(db, context, {
          products: [foreignProduct],
          prices: [],
          taxRules: [],
        }),
      ).rejects.toThrow(/scope|tenant|org/i);
      await expect(
        recordLocalSale(db, config, session, {
          lines: [{ productId: ids.product, quantityThousandths: 1.5 }],
        }),
      ).rejects.toThrow();
      const spoofedInput = {
        lines,
        localId: ids.otherProduct,
        appVersion: "forged-version",
        deviceTime: "2030-01-01T00:00:00Z",
        unitPrice: 1,
      };
      await expect(recordLocalSale(db, config, session, spoofedInput)).rejects.toThrow();
      await expect(
        recordLocalSale(
          db,
          config,
          { ...session, expiresAt: "2025-12-31T23:29:59.000Z" },
          { lines },
        ),
      ).rejects.toThrow(/expired|session|valid/i);
      expect(await snapshot(db)).toEqual(before);

      const event = await recordLocalSale(db, config, session, { lines });
      const queued = await db.read((tx) => tx.select({ localSeq: outbox.localSeq }).from(outbox));
      expect(event.sale.appVersion).toBe(config.appVersion);
      expect(queued).toEqual([{ localSeq: 1 }]);
    } finally {
      await db.close();
    }
  });
});
