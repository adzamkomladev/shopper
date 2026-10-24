import { expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { sale } from "@shopper/db-pg";
import { snapshotLine } from "@shopper/tax";
import { money } from "@shopper/money";
import { api, databases, recordSale } from "../../support/till/server";
import { push } from "../../support/till/requests";

test("v1 ingest rejects discounts that the trusted v1 producer cannot issue", async () => {
  const captured = await recordSale();
  const forged = structuredClone(captured.event);
  const line = forged.sale.lines[0];
  if (!line) throw new Error("Expected the captured sale line");
  line.tax = snapshotLine({
    rule: line.tax.rule,
    on: line.tax.on,
    taxClass: line.tax.taxClass,
    priceMode: line.tax.priceMode,
    registered: line.tax.registered,
    unitPrice: line.tax.unitPrice,
    quantityThousandths: line.tax.quantityThousandths,
    discount: money(1_000),
  });
  const { base, vat, nhil, getfund, covid, gross, roundingAdjustment } = line.tax;
  forged.sale.totals = { base, vat, nhil, getfund, covid, gross, roundingAdjustment };
  const response = await push(api, forged, captured.proof, captured.sessionId);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [],
    rejected: [{ localId: captured.event.sale.localId }],
  });
  const saved = await databases()
    .db.select()
    .from(sale)
    .where(eq(sale.localId, captured.event.sale.localId));
  expect(saved).toHaveLength(0);
});
