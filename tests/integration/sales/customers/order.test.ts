// The sale lane uploads before the customer lane, so a customer created and edited on the till is first stored from the
// sale's snapshot. The till's own create and edit that arrive afterwards must still be accepted, not conflict.
import { afterEach, expect, test } from "vite-plus/test";
import { startCounter, serverCustomer, tillAudit } from "../../../support/customers/till";
import { sellTo, serverSale } from "../../../support/customers/sale";

let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

test("create, edit, sell, then upload: the sale stores the customer and the later create and edit apply", async () => {
  counter = await startCounter();
  await counter.offline();
  const { customer } = await counter.create({ name: "Ama Mensah", phone: "0241234511" });
  await counter.ask({ type: "customer.update", customerId: customer.id, name: "Ama Owusu" });
  const sold = await sellTo(counter, customer.id);
  expect(sold.sale.customer).toMatchObject({ id: customer.id, name: "Ama Owusu" });
  await counter.online();

  expect(counter.wire()).toEqual(["sale", "sale", "customer.created", "customer.updated"]);
  for (const upload of counter.uploads()) {
    expect(upload.status).toBe(200);
    expect(upload.response).not.toHaveProperty("rejected");
  }
  expect(await serverSale(sold.saleId)).toMatchObject({ customer_id: customer.id });
  expect(await serverCustomer(customer.id)).toMatchObject({ name: "Ama Owusu", version: 2 });
  // One audit row says the sale created it; the till's create replayed without a second one.
  expect(await tillAudit("customer.sale.create", customer.id)).toHaveLength(1);
  expect(await tillAudit("customer.till.create", customer.id)).toHaveLength(0);
  expect(await tillAudit("customer.till.update", customer.id)).toHaveLength(1);
});

test("a sale to a customer the server has never seen audits the creation in the sale's own transaction", async () => {
  counter = await startCounter();
  await counter.offline();
  const { customer } = await counter.create({ name: "Kojo Asare", phone: "0241234512" });
  const sold = await sellTo(counter, customer.id);
  await counter.online();
  const [audit] = await tillAudit("customer.sale.create", customer.id);
  expect(audit).toMatchObject({
    entity: "customer",
    payload: { id: customer.id, saleId: sold.saleId },
  });
});
