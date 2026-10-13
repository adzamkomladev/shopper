import { expect, test } from "vite-plus/test";
import { openTillDatabase } from "@shopper/adapters-box/till";
import { recordLocalSale, provisionTillReference } from "@shopper/core/till";
import { hostSession, localSale, outbox, tillState } from "@shopper/db-sqlite";
import {
  config,
  context,
  ids,
  references,
  session,
  withDatabase,
} from "../../../support/till/sales";

const branch = "019a0000-0000-7000-8000-0000000000af";
const upper = (id: string) => id.toUpperCase();
const lines = [{ productId: ids.product, quantityThousandths: 1_000 }];

test("matches uppercase branch configuration to its lowercase branch price", async () => {
  await withDatabase(async (path) => {
    const db = openTillDatabase(path);
    try {
      const branchReferences = {
        ...references,
        prices: references.prices.map((price) =>
          price.branchId ? { ...price, branchId: branch } : price,
        ),
      };
      await provisionTillReference(db, context, branchReferences);
      const event = await recordLocalSale(
        db,
        { ...config, branchId: upper(branch) },
        { ...session, branchId: upper(branch) },
        { lines },
      );
      expect(event.sale.branchId).toBe(branch);
      expect(event.sale.lines[0]).toMatchObject({
        priceId: ids.branchPrice,
        tax: { unitPrice: 12_000 },
      });
    } finally {
      await db.close();
    }
  });
});

test("resolves uppercase product selectors against lowercase local references", async () => {
  await withDatabase(async (path) => {
    const db = openTillDatabase(path);
    try {
      await provisionTillReference(db, context, references);
      const event = await recordLocalSale(db, config, session, {
        lines: [{ productId: upper(ids.product), quantityThousandths: 1_000 }],
      });
      expect(event.sale.lines[0]?.productId).toBe(ids.product);
      expect(event.sale.lines[0]?.sku).toBe("MILK-001");
    } finally {
      await db.close();
    }
  });
});

test("normalizes mixed-case scope and reuses one saved cashier session", async () => {
  await withDatabase(async (path) => {
    const db = openTillDatabase(path);
    try {
      await provisionTillReference(db, context, references);
      const uppercaseConfig = {
        ...config,
        orgId: upper(ids.org),
        deviceId: upper(ids.device),
        storeId: upper(config.storeId),
        branchId: upper(ids.branch),
      };
      const uppercaseSession = {
        ...session,
        id: upper(session.id),
        orgId: upper(session.orgId),
        deviceId: upper(session.deviceId),
        branchId: upper(session.branchId),
        userId: upper(session.userId),
      };
      const first = await recordLocalSale(db, uppercaseConfig, uppercaseSession, { lines });
      const second = await recordLocalSale(db, config, session, { lines });
      const saved = await db.read(async (tx) => ({
        sessions: await tx.select().from(hostSession),
        sales: await tx.select().from(localSale),
        outbox: await tx.select().from(outbox),
        state: await tx.select().from(tillState),
      }));
      expect(saved.sessions).toHaveLength(1);
      expect(saved.sales).toHaveLength(2);
      expect(saved.outbox.map((row) => row.localSeq).sort((a, b) => a - b)).toEqual([1, 2]);
      expect(saved.state).toHaveLength(1);
      for (const event of [first, second])
        expect(event.sale).toMatchObject({
          orgId: ids.org,
          deviceId: ids.device,
          storeId: config.storeId,
          branchId: ids.branch,
          cashierId: ids.cashier,
          sessionId: ids.session,
        });
    } finally {
      await db.close();
    }
  });
});
