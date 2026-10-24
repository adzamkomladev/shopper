import { useState } from "react";
import type { AccountRead, AccountTender } from "../../../sale/account/types";
import type { SaleActions } from "../../../sale/types";

/**
 * What the attached customer may spend, read from the server when the cashier picks On account or Points
 * and again after each account tender. A read for another customer is never shown, so removing or changing
 * the customer drops it. `refusal` is the server's own reason for the last tender it refused.
 */
export function useAccountRead(
  customerId: string | null,
  actions: Pick<SaleActions, "loadAccount" | "addAccountTender">,
) {
  const [read, setRead] = useState<AccountRead | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const current = read && read.customerId === customerId ? read : null;

  async function load(quiet = false) {
    if (!customerId) return;
    if (!quiet) setRead({ customerId, status: "loading" });
    const result = await actions.loadAccount(customerId);
    setRead(
      result.ok
        ? { customerId, status: "ready", account: result.account }
        : { customerId, status: "failed", message: result.message },
    );
  }

  /** True when the tender is on the basket. Otherwise `refusal` says why, next to the amount. */
  async function add(input: AccountTender) {
    setRefusal(null);
    const outcome = await actions.addAccountTender(input);
    // Either way what is available has moved, so the summary reads again.
    void load(true);
    if (outcome.ok) return true;
    setRefusal(outcome.message);
    return false;
  }

  return {
    read: current,
    account: current?.status === "ready" ? current.account : null,
    refusal,
    clearRefusal: () => setRefusal(null),
    load,
    add,
  };
}
