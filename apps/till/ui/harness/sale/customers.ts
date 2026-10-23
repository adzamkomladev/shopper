// Test-only customers for the till UI harness: a small directory the dialog looks numbers up in, the scenarios that
// start with a customer (or without access to customers), and the actions that behave as the host would.
import type { Dispatch, SetStateAction } from "react";
import type {
  BasketCustomer,
  CustomerActions,
  CustomerRecord,
} from "../../src/sale/customer/types";
import type { SaleSnapshot } from "../../src/sale/types";
import { emptyView, id } from "../fixtures";

type Recorder = (type: string) => (...args: unknown[]) => unknown;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const person = (suffix: string, change: Partial<CustomerRecord>): CustomerRecord => ({
  id: id(suffix),
  name: "Customer",
  phone: "0241234567",
  kind: "individual",
  businessName: null,
  tin: null,
  version: 1,
  pending: false,
  ...change,
});
const ama = person("501", { name: "Ama Mensah" });
const kofi = person("502", { name: "Kofi Boateng", phone: "0240000002" });
// Two customers share 0240000002; the business one was made on this register and has not uploaded.
const traders = person("503", {
  name: "Kofi Mensah",
  phone: "0240000002",
  kind: "business",
  businessName: "Kofi Traders Ltd",
  tin: "C0012345678",
  pending: true,
});
/** "0240000500" is a number the register fails to look up. */
export const brokenPhone = "0240000500";

const directory = new Map([ama, kofi, traders].map((customer) => [customer.id, customer]));
const basketOf = ({
  id,
  name,
  phone,
  kind,
  businessName,
  tin,
}: CustomerRecord): BasketCustomer => ({
  id,
  name,
  phone,
  kind,
  businessName,
  tin,
});

/** Scenarios for the customer specs, built on the sale screen's own `lines` snapshot. */
export function customerScenarios(base: SaleSnapshot): Record<string, SaleSnapshot> {
  const attached = (customer: CustomerRecord): SaleSnapshot => ({
    ...base,
    view: { ...base.view!, customer: basketOf(customer) },
  });
  return {
    customers: base,
    "customers-empty": { ...base, view: emptyView },
    "customers-attached": attached(ama),
    "customers-business": attached(traders),
    "customers-offline": { ...base, sync: { ...base.sync, offline: true, pendingCount: 1 } },
    "customers-readonly": { ...base, permissions: ["customer.read"] },
    "customers-nopermission": { ...base, permissions: [] },
  };
}

export function customerActions(
  record: Recorder,
  setSale: Dispatch<SetStateAction<SaleSnapshot>>,
): CustomerActions {
  return {
    async findCustomers(phone) {
      record("findCustomers")(phone);
      await sleep(60);
      if (phone === brokenPhone)
        return { ok: false, message: "The register could not look that up" };
      return { ok: true, customers: [...directory.values()].filter((c) => c.phone === phone) };
    },
    async saveCustomer(fields, customerId) {
      if (customerId === undefined) record("saveCustomer")(fields);
      else record("saveCustomer")(fields, customerId);
      const saved = {
        ...fields,
        id: customerId ?? id(String(600 + directory.size)),
        version: 1,
        pending: true,
      };
      directory.set(saved.id, saved);
      return { ok: true, customer: saved };
    },
    async attachCustomer(customerId) {
      record("attachCustomer")(customerId);
      const customer = customerId ? directory.get(customerId) : undefined;
      setSale((current) => ({
        ...current,
        view: current.view && { ...current.view, customer: customer ? basketOf(customer) : null },
      }));
      return { ok: true };
    },
  };
}
