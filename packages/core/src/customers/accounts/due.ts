import { nextInterestAt } from "../credit/interest";
import { lotExpiry, pointLots } from "../loyalty/points";
import type { AccountSettings, AccountState } from "./types";

/**
 * Pure: the next moment the account needs a posting, the earliest of the oldest unposted interest date (the 1st
 * of a month with a balance past its terms, possibly already past), the next lot expiry and the next tier notice. Null when nothing is due.
 */
export function nextDue(customer: AccountState, settings: AccountSettings) {
  if (customer.archived) return null;
  const interest =
    settings.interestBps > 0 ? nextInterestAt(customer.credit, settings.termsDays) : null;
  const expiry =
    settings.loyaltyEnabled && settings.expiryDays > 0
      ? pointLots(customer.points)
          .filter((lot) => lot.left > 0)
          .map((lot) => lotExpiry(lot, settings.expiryDays))
      : [];
  const due = [interest, ...expiry, customer.noticeAt].filter((at): at is Date => at !== null);
  return due.length ? new Date(Math.min(...due.map((at) => at.getTime()))) : null;
}
