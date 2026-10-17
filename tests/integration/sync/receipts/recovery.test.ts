import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { startRegister } from "../../../support/hardware/host";
import { auditsOfAsset, receiptAssets, startReceiptApi } from "../../../support/sync/receipts";

let server: Awaited<ReturnType<typeof startReceiptApi>>;
beforeAll(async () => {
  server = await startReceiptApi();
});
afterAll(async () => server?.close());

test("a till that crashed between confirm and its local mark records the upload without a new PUT", async () => {
  const register = await startRegister({ upstream: server.url });
  try {
    const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);
    await expect
      .poll(async () => (await register.receiptOutput(saleId))?.uploaded_at ?? null, {
        timeout: 30_000,
      })
      .not.toBeNull();
    const [asset] = await receiptAssets(saleId);

    // Forget the local mark, as if the process died right after the server linked the receipt.
    await register.fixture.database.transaction((tx) =>
      tx.run(
        sql`update receipt_output set asset_id = null, uploaded_at = null where sale_id = ${saleId}`,
      ),
    );
    await register.ask({ type: "retry" });
    await expect
      .poll(async () => (await register.receiptOutput(saleId))?.uploaded_at ?? null, {
        timeout: 30_000,
      })
      .not.toBeNull();
    expect((await register.receiptOutput(saleId))?.asset_id).toBe(asset!.id);
    // The server issued and confirmed once; the recovery only recorded the result locally.
    expect(await auditsOfAsset("asset.receipt.issue", asset!.id)).toHaveLength(1);
    expect(await auditsOfAsset("asset.receipt.confirm", asset!.id)).toHaveLength(1);
    expect(await register.audit("receipt.pdf.upload")).toHaveLength(2);
  } finally {
    await register.close();
  }
});
