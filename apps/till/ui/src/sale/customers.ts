import type { BridgeMessage } from "@shopper/sync/bridge";
import { request } from "../connection/store";
import type { BasketCustomer, CustomerActions } from "./customer/types";
import type { createSaleOperations } from "./operations";

const lost = "The register connection ended. Reconnect and try again.";
const failure = (reply: BridgeMessage | undefined) =>
  reply?.type === "error"
    ? { code: reply.code, message: reply.message }
    : { code: "CONNECTION_LOST", message: lost };

/** The three customer actions, answered by the register host. `runDraft` is the basket's own revisioned call. */
export function customerActions(
  runDraft: ReturnType<typeof createSaleOperations>["runDraft"],
): CustomerActions {
  return {
    async findCustomers(phone) {
      const reply = await request({ type: "customer.find", phone });
      if (reply?.type === "result" && reply.kind === "customers")
        return { ok: true, customers: reply.customers };
      return { ok: false, message: failure(reply).message };
    },
    async saveCustomer(fields, id) {
      const reply = await request(
        id
          ? { type: "customer.update", customerId: id, ...fields }
          : { type: "customer.create", ...fields },
      );
      if (reply?.type === "result" && reply.kind === "customer")
        return { ok: true, customer: reply.customer };
      return { ok: false, ...failure(reply) };
    },
    attachCustomer: (customerId) =>
      runDraft((expectedRevision) => ({ type: "customer.attach", expectedRevision, customerId })),
  };
}

/** 0241234567 as 024 ••• 4567: enough to tell two customers apart, not enough to read out. */
export function maskPhone(phone: string) {
  return phone.length === 10 ? `${phone.slice(0, 3)} ••• ${phone.slice(6)}` : phone;
}

/** 024 123 4567, as a cashier reads and types it. */
export function spacedPhone(phone: string) {
  return phone.length === 10
    ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`
    : phone;
}

/** The name on the invoice: the business when there is one. */
export const displayName = (customer: Pick<BasketCustomer, "name" | "businessName">) =>
  customer.businessName || customer.name;

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    (words[0]?.[0] ?? "") + (words.length > 1 ? (words.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}
