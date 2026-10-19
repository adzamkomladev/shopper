import { afterEach, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { bridgeMessage } from "@shopper/sync/bridge";
import { createHostFixture } from "../../../../support/till/host/fixture";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
afterEach(async () => fixture?.close());

test("the browser completes an audited cash sale and can start the next basket", async () => {
  fixture = await createHostFixture({ freshSession: true });
  const host = await fixture.start({
    ...fixture.config,
    receiptReference: {
      branchName: "Osu branch",
      cashierName: "Ama Mensah",
      tin: "TIN12345",
      address: "Oxford Street, Accra",
    },
  });
  await host.request({
    type: "add",
    expectedRevision: 0,
    productId: fixture.config.references.products[0].id,
  });
  const tender = await host.request({
    type: "tender.add",
    expectedRevision: 1,
    kind: "cash",
    amount: 20_000,
  });
  expect(tender).toMatchObject({ kind: "draft", view: { draft: { revision: 2 } } });
  expect(v.safeParse(bridgeMessage, tender).success).toBe(true);
  const completed = await host.request({ type: "sale.complete", expectedRevision: 2 });
  expect(completed).toMatchObject({
    kind: "sale",
    event: { v: 4, sale: { paid: 20_000, change: 8_000 } },
  });
  expect(v.safeParse(bridgeMessage, completed).success).toBe(true);
  expect(completed).toMatchObject({
    receipt: {
      header: {
        branch: "Osu branch",
        cashier: "Ama Mensah",
        tin: "TIN12345",
        address: "Oxford Street, Accra",
      },
    },
  });
  expect(await host.request({ type: "readDraft" })).toMatchObject({ view: { draft: null } });
  expect(await fixture.localSales()).toHaveLength(1);
});
