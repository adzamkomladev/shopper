import { infiniteQueryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { rangeOf } from "../../lib/reports/range";
import { shopToday } from "../../lib/tax/dates";
import { transactionPage, type TransactionSearch } from "../../schemas/transactions";
import { currentShop } from "../../stores/shops";

const key = (shop = currentShop()) => ["transactions", shop?.id ?? "box"] as const;

/** The range the explorer shows: its address's, else today. */
export const transactionRange = (search: TransactionSearch) =>
  rangeOf({ from: search.from ?? search.to ?? shopToday(), to: search.to });

/** The API's query string for the explorer's filters, without a page. */
export function transactionParams(search: TransactionSearch) {
  const range = transactionRange(search);
  const params = new URLSearchParams({ from: range.from, to: range.to });
  for (const name of ["q", "branchId", "tender", "status"] as const)
    if (search[name]) params.set(name, search[name]);
  return params;
}

/** Sales and unused MoMo payments, newest first, 25 a page, with the counts for each status tab. */
export function transactionsQuery(search: TransactionSearch) {
  const params = transactionParams(search);
  return infiniteQueryOptions({
    queryKey: [...key(), "list", params.toString()],
    queryFn: ({ pageParam }) => {
      const page = new URLSearchParams(params);
      if (pageParam) page.set("cursor", pageParam);
      return apiFetch(`/transactions?${page}`, transactionPage);
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.next ?? undefined,
  });
}

export const transactionKey = key;
