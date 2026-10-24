// Test-only accounts for the till UI harness: what each customer may spend, the scenarios that sell on account or take
// a payment, and the actions that answer as the host would.
import type { Dispatch, SetStateAction } from "react";
import { pointsWorth } from "../../src/sale/account/rules";
import type { AccountActions, AccountView, PaymentActions } from "../../src/sale/account/types";
import type { SaleSnapshot } from "../../src/sale/types";
import { addTender } from "./tenders";
import { attached, directory, lookupPhone } from "./customers";

type Recorder = (type: string) => (...args: unknown[]) => unknown;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const view = (change: Partial<AccountView>): AccountView => ({
  limit: 5_000_000,
  balance: 1_200_000,
  held: 0,
  available: 3_800_000,
  eligible: true,
  points: 1240,
  pointValue: 100,
  loyaltyEnabled: true,
  ...change,
});
/** Amounts are in GH₵ x 10 000: Ama owes 120 of a 500 limit; Kofi has 50 left; Kofi Traders hold a 200 deposit. */
const accounts = new Map<string, AccountView>([
  [directory.ama.id, view({})],
  [
    directory.kofi.id,
    view({ limit: 1_000_000, balance: 500_000, available: 500_000, points: 300 }),
  ],
  [
    directory.traders.id,
    view({ limit: 0, balance: -2_000_000, available: 2_000_000, points: 0, loyaltyEnabled: false }),
  ],
  [directory.esi.id, view({ limit: 0, balance: 0, available: 0, eligible: false, points: 0 })],
]);

/** Scenarios for the account tender and payment specs, built on the sale screen's own `lines` snapshot. */
export function accountScenarios(base: SaleSnapshot): Record<string, SaleSnapshot> {
  const ama = attached(base, directory.ama);
  return {
    accounts: ama,
    "accounts-slow": ama,
    "accounts-failed": ama,
    "accounts-refused": ama,
    "accounts-limited": attached(base, directory.kofi),
    "accounts-deposit": attached(base, directory.traders),
    "accounts-ineligible": attached(base, directory.esi),
    "accounts-offline": {
      ...ama,
      sync: { ...ama.sync, offline: true, pendingCount: 1 },
    },
    payments: base,
    "payments-refused": base,
    "payments-noslip": base,
  };
}

export function accountActions(
  name: string,
  record: Recorder,
  setSale: Dispatch<SetStateAction<SaleSnapshot>>,
): AccountActions {
  return {
    async loadAccount(customerId) {
      record("loadAccount")(customerId);
      await sleep(name === "accounts-slow" ? 1200 : 40);
      const account = accounts.get(customerId);
      if (name === "accounts-failed" || !account)
        return {
          ok: false,
          code: "OFFLINE_UNAVAILABLE",
          message: "Connect to the internet to sell on account",
        };
      return { ok: true, account };
    },
    async addAccountTender(input) {
      record("addAccountTender")(input);
      if (name === "accounts-refused")
        return {
          ok: false,
          code: "CREDIT_LIMIT",
          message: "Over the credit limit. GH₵ 20.00 available.",
        };
      setSale((current) => {
        const pointValue = accounts.get(current.view?.customer?.id ?? "")?.pointValue ?? 100;
        return addTender(
          current,
          input.kind === "credit"
            ? input
            : { ...input, amount: pointsWorth(input.points, pointValue) },
        );
      });
      return { ok: true };
    },
  };
}

export function paymentActions(name: string, record: Recorder): PaymentActions {
  return {
    async find(phone) {
      record("findPayer")(phone);
      await sleep(40);
      return { ok: true, customers: lookupPhone(phone) };
    },
    async owed(customerId) {
      await sleep(80);
      const account = accounts.get(customerId);
      return account
        ? { ok: true, account }
        : {
            ok: false,
            code: "CUSTOMER_UNKNOWN",
            message: "The server does not know this customer",
          };
    },
    async pay(input) {
      record("accountPayment")(input);
      await sleep(60);
      if (name === "payments-refused")
        return {
          ok: false,
          code: "INVALID_INPUT",
          message: "The register could not save the payment",
        };
      return { ok: true, printed: name !== "payments-noslip" };
    },
  };
}
