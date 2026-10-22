// Selling to a customer on a counter (see ./till.ts), and reading the sale as the server stored it.
//   sellTo(counter, customerId | null, cash?) -> { saleId, sale, receipt } of a one-product cash sale
//   serverSale(saleId)                        -> { customer_id, event_version, receipt }, or undefined until it uploaded
import { sql } from "drizzle-orm";
import { expect } from "vite-plus/test";
import { ids } from "../till/sales";
import { databases } from "../till/server";
import type { startCounter } from "./till";

type Counter = Awaited<ReturnType<typeof startCounter>>;

/** Basket revisions: add 1, attach 2, tender 3 (2 without a customer), then complete. */
export async function sellTo(counter: Counter, customerId: string | null, cash = 12_000) {
  const productId = counter.register.fixture.config.references.products[0].id;
  await counter.ask({ type: "add", expectedRevision: 0, productId });
  let revision = 1;
  if (customerId) {
    const attached = await counter.ask({
      type: "customer.attach",
      expectedRevision: 1,
      customerId,
    });
    expect(attached).toMatchObject({ kind: "draft", view: { customer: { id: customerId } } });
    revision += 1;
  }
  expect(
    await counter.ask({
      type: "tender.add",
      expectedRevision: revision,
      kind: "cash",
      amount: cash,
    }),
  ).toMatchObject({ kind: "draft" });
  const reply = await counter.ask({ type: "sale.complete", expectedRevision: revision + 1 });
  expect(reply).toMatchObject({ type: "result", kind: "sale" });
  return { saleId: reply.event.sale.id as string, sale: reply.event.sale, receipt: reply.receipt };
}

export async function serverSale(saleId: string) {
  const { rows } = await databases().db.execute<Record<string, any>>(sql`
    SELECT customer_id, event_version::int AS event_version, receipt FROM sale
    WHERE org_id = ${ids.org} AND id = ${saleId}`);
  return rows[0];
}
