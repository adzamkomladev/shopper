// Selling on account through a running counter (see ./till.ts), the way a cashier does.
//   Assumed bridge: {type:"customer.account", customerId} -> {kind:"account", account:{limit,balance,held,available,
//   eligible,points,pointValue,loyaltyEnabled}}; {type:"tender.account", expectedRevision, kind:"credit", amount} -> a
//   draft view whose tenders hold a kind "credit" row (its id is the hold id).
//   basketOf(counter, customerId, units)        -> revision 2: `units` of the first product (12 000 each), customer attached
//   onAccount(counter, revision, amount)        -> the reply to tender.account
//   heldTender(counter, revision, amount)       -> the same, checked: the id of the new credit tender (its hold)
//   creditSale(counter, customerId, {units, credit, cash}) -> the completed sale, with the tender id that is its hold id
//   arrived(counter, saleId)                    -> waits until the server has the sale, then answers its row
//   holdPosts(counter)                          -> the hold creates and releases the counter sent upstream
//   withManager(counter)                        -> teaches the register one manager who may approve voids
import { expect } from "vite-plus/test";
import { v7 } from "uuid";
import { hashPin } from "@shopper/auth/devices";
import { refreshApprovers } from "@shopper/core/till";
import { pin } from "../till/approvers";
import { serverSale } from "./sale";
import type { startCounter } from "./till";

type Counter = Awaited<ReturnType<typeof startCounter>>;
type Reply = Record<string, any>;
export const UNIT = 12_000;

export async function basketOf(counter: Counter, customerId: string, units: number) {
  const productId = counter.register.fixture.config.references.products[0].id;
  await counter.ask({
    type: "add",
    expectedRevision: 0,
    productId,
    quantityThousandths: units * 1000,
  });
  const attached = await counter.ask({ type: "customer.attach", expectedRevision: 1, customerId });
  expect(attached).toMatchObject({ kind: "draft", view: { customer: { id: customerId } } });
}

export const onAccount = (
  counter: Counter,
  expectedRevision: number,
  amount: number,
): Promise<Reply> =>
  counter.ask({ type: "tender.account", expectedRevision, kind: "credit", amount });

/** Takes the hold at `expectedRevision` and answers its id, which is the id of the new credit tender. */
export async function heldTender(counter: Counter, expectedRevision: number, amount: number) {
  const reply = await onAccount(counter, expectedRevision, amount);
  expect(reply).toMatchObject({ type: "result", kind: "draft" });
  const tender = reply.view.draft.tenders.find((t: { kind: string }) => t.kind === "credit");
  expect(tender).toMatchObject({ kind: "credit", amount });
  return tender.id as string;
}

export async function creditSale(
  counter: Counter,
  customerId: string,
  options: { units: number; credit: number; cash?: number },
) {
  await basketOf(counter, customerId, options.units);
  const tenderId = await heldTender(counter, 2, options.credit);
  let revision = 3;
  if (options.cash) {
    const cash = await counter.ask({
      type: "tender.add",
      expectedRevision: revision,
      kind: "cash",
      amount: options.cash,
    });
    expect(cash).toMatchObject({ kind: "draft" });
    revision += 1;
  }
  const done = await counter.ask({ type: "sale.complete", expectedRevision: revision });
  expect(done).toMatchObject({ type: "result", kind: "sale" });
  const sale = done.event.sale;
  return { saleId: sale.id as string, sale, tenderId, receipt: sale.receiptNumber as string };
}

export async function arrived(counter: Counter, saleId: string) {
  let row: Awaited<ReturnType<typeof serverSale>>;
  await expect
    .poll(
      async () => {
        await counter.sync();
        row = await serverSale(saleId);
        return row;
      },
      { timeout: 20_000, interval: 250 },
    )
    .toBeDefined();
  return row!;
}

export const holdPosts = (counter: Counter) =>
  counter.upstream.requests.filter((r) => r.path.startsWith("/sync/customers/holds"));

export async function withManager(counter: Counter) {
  const manager = v7();
  const { identity } = counter.register.fixture.config;
  await refreshApprovers(
    counter.register.fixture.database,
    { orgId: identity.orgId, deviceId: identity.deviceId, appVersion: "0.0.0-test" },
    {
      approvers: [
        {
          userId: manager,
          name: "Esi Manager",
          pinHash: await hashPin(pin),
          permissions: ["sale.void"],
        },
      ],
      at: new Date(),
    },
  );
  return { approverId: manager, pin };
}
