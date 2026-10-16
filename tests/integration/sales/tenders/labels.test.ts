import { expect, test } from "vite-plus/test";
import { barcodeMapping, productBarcode } from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { acceptSale } from "@shopper/core/sales";
import { money } from "@shopper/money";
import { snapshotAmount } from "@shopper/tax";
import { databases, deviceId, recordSale } from "../../../support/till/server";

const configure = defineCommand({
  name: "sale.test.labels",
  async run(tx, ctx, productId: string) {
    await tx.insert(productBarcode).values({ orgId: ctx.orgId, productId, code: "12345" });
    await tx.insert(barcodeMapping).values({
      orgId: ctx.orgId,
      prefix: 25,
      productStart: 2,
      productLength: 5,
      valueStart: 7,
      valueLength: 5,
      kind: "price",
      decimals: 2,
    });
    return {};
  },
  audit: () => ({}),
});

test("ingest retains the authoritative price label gross instead of repricing its rounded quantity", async () => {
  const created = await recordSale();
  const event = structuredClone(created.event);
  const line = event.sale.lines[0]!;
  const { db, context } = databases();
  await configure(db, context, line.productId);
  const digits = "251234510051";
  const checksum =
    (10 -
      (Array.from(digits).reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) %
        10)) %
    10;
  line.label = { kind: "price", code: `${digits}${checksum}`, originalPriceId: line.priceId };
  line.tax = snapshotAmount({ ...line.tax, quantityThousandths: 83_758, gross: money(1_005_100) });
  for (const key of Object.keys(event.sale.totals) as (keyof typeof event.sale.totals)[])
    event.sale.totals[key] = line.tax[key];
  event.sale.total = line.tax.gross;
  event.sale.paid = line.tax.gross;
  event.sale.tenders[0]!.amount = line.tax.gross;
  await expect(
    acceptSale(
      db,
      {
        orgId: context.orgId,
        deviceId,
        branchId: event.sale.branchId,
        storeId: event.sale.storeId,
      },
      event,
      created.proof,
    ),
  ).resolves.toMatchObject({ localId: event.sale.id });
});
