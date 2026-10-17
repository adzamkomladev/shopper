import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { startHostUpstream } from "../../../support/till/host/upstream";
import { startRegister, type Register } from "../../../support/hardware/host";
import { linkedAsset, receiptAssets, startReceiptApi } from "../../../support/sync/receipts";

type ReceiptApi = Awaited<ReturnType<typeof startReceiptApi>>;
let withoutStorage: ReceiptApi;
let withStorage: ReceiptApi;
let register: Register | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
beforeAll(async () => {
  withoutStorage = await startReceiptApi({ s3: false });
  withStorage = await startReceiptApi();
});
afterEach(async () => {
  await register?.close();
  await upstream?.close();
  register = upstream = undefined;
});
afterAll(async () => {
  await withoutStorage?.close();
  await withStorage?.close();
});

test("a 503 from unconfigured storage keeps the PDF pending with an attempt counted, and the next acknowledgement uploads it", async () => {
  let current: ReceiptApi = withoutStorage;
  upstream = await startHostUpstream({
    url: withoutStorage.url,
    request: (path, init) => current.request(path, init),
  });
  register = await startRegister({ upstream: upstream.url });
  const first = await register.sell([{ kind: "cash", amount: 12_000 }]);

  await expect
    .poll(async () => (await register!.receiptOutput(first.saleId))?.upload_attempts ?? 0, {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(1);
  expect(upstream.requests.find((request) => request.path === "/sync/receipts")).toMatchObject({
    status: 503,
  });
  expect(await register.receiptOutput(first.saleId)).toMatchObject({
    asset_id: null,
    uploaded_at: null,
  });
  expect(await receiptAssets(first.saleId)).toHaveLength(0);
  expect(await linkedAsset(first.saleId)).toBeNull();

  // Storage is configured and the next sale is acknowledged: both pending PDFs go up.
  current = withStorage;
  const second = await register.sell([{ kind: "card", amount: 12_000 }]);
  for (const { saleId } of [first, second]) {
    await expect
      .poll(async () => (await register!.receiptOutput(saleId))?.uploaded_at ?? null, {
        timeout: 30_000,
      })
      .not.toBeNull();
    const [asset] = await receiptAssets(saleId);
    expect(await linkedAsset(saleId)).toBe(asset!.id);
  }
});
