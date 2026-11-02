import { shopToday } from "../tax/dates";
import type { LedgerSearch } from "../../schemas/ledger/views";

/** The days a ledger view covers: the search's, else this month to today. */
export function ledgerRange(search: LedgerSearch) {
  const today = shopToday();
  return { from: search.from ?? `${today.slice(0, 7)}-01`, to: search.to ?? today };
}
