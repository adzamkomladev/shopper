// A sale to a customer carries a snapshot of it (sale v5 `customer`: {id,name,phone,kind,businessName,tin}) because the till's
// document lane uploads after sales. The server upserts the customer from it; the receipt (v3) prints `buyer: {name,tin}`
// only for a customer with a TIN, named by its businessName when it has one.
import { afterEach, expect, test } from "vite-plus/test";
import { fiscalPayload } from "@shopper/core/receipts";
import { registerSettings, startPrinter, type Printer } from "../../../support/hardware/host";
import { sellTo, serverSale } from "../../../support/customers/sale";
import { serverCustomer, startCounter, customersByPhone } from "../../../support/customers/till";

let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
let printer: Printer | undefined;
afterEach(async () => {
  await counter?.close();
  await printer?.stop();
  counter = printer = undefined;
});

const buyer = { name: "Kofi Traders Ltd", tin: "C0012345678" };

async function printingCounter() {
  counter = await startCounter();
  printer = await startPrinter();
  await counter.register.configure(registerSettings(printer.port));
  return counter;
}

test("B2B sale carries buyer TIN onto the invoice and fiscal payload", async () => {
  const till = await printingCounter();
  await till.offline(); // a walk-in sale stays queued ahead of everything below
  const { customer } = await till.create({
    name: "Kofi Mensah",
    phone: "0241234599",
    kind: "business",
    businessName: "Kofi Traders Ltd",
    tin: "C0012345678",
  });
  const sold = await sellTo(till, customer.id);

  // On the till: the sale holds the snapshot and the receipt shows the buyer, before anything uploaded.
  expect(sold.sale.customer).toEqual({
    id: customer.id,
    name: "Kofi Mensah",
    phone: "0241234599",
    kind: "business",
    businessName: "Kofi Traders Ltd",
    tin: "C0012345678",
  });
  expect(sold.receipt).toMatchObject({ v: 5, buyer });
  expect(await serverCustomer(customer.id)).toBeUndefined();

  await till.online();

  // The sale went first; the customer upload then replays without a second customer or a changed version.
  expect(till.wire()[0]).toBe("sale");
  expect(till.wire().at(-1)).toBe("customer.created");
  expect(till.uploads()[0]!.response).toMatchObject({ accepted: { id: customer.id } });
  expect(await customersByPhone("0241234599")).toEqual([customer.id]);
  expect(await serverCustomer(customer.id)).toMatchObject({
    name: "Kofi Mensah",
    kind: "business",
    business_name: "Kofi Traders Ltd",
    tin: "C0012345678",
    version: 1,
  });

  // On the server: linked, and the stored receipt is the v3 invoice.
  const stored = await serverSale(sold.saleId);
  expect(stored).toMatchObject({ customer_id: customer.id, event_version: 7 });
  expect(stored!.receipt).toMatchObject({ v: 5, buyer });
  expect(fiscalPayload(stored!.receipt).buyer).toEqual(buyer);
  expect(fiscalPayload(stored!.receipt).buyer!.tin).toBe("C0012345678");

  // On paper: the walk-in sale has no buyer block; the B2B one prints the name and TIN.
  const [walkIn, invoice] = await printer!.waitForJobs(2);
  expect(walkIn!.page).not.toContain("Buyer");
  expect(invoice!.text).toContain("Buyer");
  expect(invoice!.text).toContain("Kofi Traders Ltd");
  expect(invoice!.text).toContain("TIN C0012345678");
  expect(invoice!.text).toContain("TIN P0012345678"); // the seller's own line is still there
});

test("a walk-in sale has buyer null on every document and no customer", async () => {
  const till = await printingCounter();
  const sold = await sellTo(till, null);
  expect(sold.sale.customer).toBeNull();
  expect(sold.receipt).toMatchObject({ v: 5, buyer: null });
  await till.settle();
  expect(await serverSale(sold.saleId)).toMatchObject({ customer_id: null, event_version: 7 });
  const stored = (await serverSale(sold.saleId))!.receipt;
  expect(stored).toMatchObject({ v: 5, buyer: null });
  expect(fiscalPayload(stored).buyer).toBeNull();
  const [job] = await printer!.waitForJobs(1);
  expect(job!.page).not.toContain("Buyer");
});

test("an individual without a TIN is linked to the sale but is not a buyer on the invoice", async () => {
  const till = await printingCounter();
  const { customer } = await till.create({ name: "Ama Boateng", phone: "0241234598" });
  const sold = await sellTo(till, customer.id);
  expect(sold.sale.customer).toMatchObject({ id: customer.id, name: "Ama Boateng", tin: null });
  expect(sold.receipt).toMatchObject({ buyer: null });
  await till.settle();
  const stored = await serverSale(sold.saleId);
  expect(stored).toMatchObject({ customer_id: customer.id });
  expect(stored!.receipt).toMatchObject({ v: 5, buyer: null });
  expect(fiscalPayload(stored!.receipt).buyer).toBeNull();
  expect(await serverCustomer(customer.id)).toMatchObject({ name: "Ama Boateng", version: 1 });
  const [job] = await printer!.waitForJobs(1);
  expect(job!.page).not.toContain("Buyer");
});
