import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { downloadFile } from "../../lib/download";
import {
  accountLinesView,
  accountView,
  balanceView,
  chartView,
  journalView,
  lockView,
  postedView,
  profitView,
  trialView,
  type Statement,
} from "../../schemas/ledger/views";
import { currentShop } from "../../stores/shops";

const key = (...rest: string[]) => ["ledger", currentShop()?.id ?? "box", ...rest] as const;
const range = (from: string, to: string) => `from=${from}&to=${to}`;

/** The chart of accounts with each balance to date, and the lock date. */
export const chartQuery = () =>
  queryOptions({ queryKey: key("chart"), queryFn: () => apiFetch("/ledger/accounts", chartView) });

export const accountLinesQuery = (id: string, from: string, to: string) =>
  queryOptions({
    queryKey: key("account", id, from, to),
    queryFn: () => apiFetch(`/ledger/accounts/${id}/lines?${range(from, to)}`, accountLinesView),
  });

export const journalQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: key("journal", from, to),
    queryFn: () => apiFetch(`/ledger/journal?${range(from, to)}`, journalView),
  });

const statementViews = { trial: trialView, profit: profitView, balance: balanceView };
const statementQuery = (statement: Statement, from: string, to: string) =>
  statement === "profit" ? range(from, to) : `asOf=${to}`;

export const trialQuery = (asOf: string) =>
  queryOptions({
    queryKey: key("trial", asOf),
    queryFn: () => apiFetch(`/ledger/reports/trial?asOf=${asOf}`, statementViews.trial),
  });
export const profitQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: key("profit", from, to),
    queryFn: () => apiFetch(`/ledger/reports/profit?${range(from, to)}`, statementViews.profit),
  });
export const balanceQuery = (asOf: string) =>
  queryOptions({
    queryKey: key("balance", asOf),
    queryFn: () => apiFetch(`/ledger/reports/balance?asOf=${asOf}`, statementViews.balance),
  });

/** Downloads a statement as CSV, for the same days the screen shows. */
export function useStatementExport(statement: Statement, from: string, to: string) {
  return useMutation({
    mutationFn: () =>
      downloadFile(
        `/ledger/reports/${statement}.csv?${statementQuery(statement, from, to)}`,
        `${statement}-${statement === "profit" ? `${from}-${to}` : to}.csv`,
        {
          unreachable: "Can't reach the server. Check your connection and try again.",
          denied: "Your account can't download the books.",
          failed: "The statement couldn't be downloaded. Try again.",
        },
      ),
    onError: (failure) => toast.error(failure.message),
  });
}

/** A write to the books: on success every ledger view is read again, since balances move everywhere. */
function useLedgerWrite<T>(
  request: (body: T) => Promise<unknown>,
  done: string,
  onDone: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async () => {
      toast.success(done);
      onDone();
      await queryClient.invalidateQueries({ queryKey: key() });
    },
  });
}

export const usePostJournal = (onDone: () => void) =>
  useLedgerWrite(
    (body: unknown) => apiFetch("/ledger/journal", postedView, { method: "POST", body }),
    "Entry posted",
    onDone,
  );

export const useReverseEntry = (onDone: () => void) =>
  useLedgerWrite(
    (body: { id: string; postedOn: string }) =>
      apiFetch(`/ledger/journal/${body.id}/reverse`, postedView, {
        method: "POST",
        body: { postedOn: body.postedOn },
      }),
    "Entry reversed",
    onDone,
  );

export const useSaveAccount = (id: string | undefined, onDone: () => void) =>
  useLedgerWrite(
    (body: unknown) =>
      apiFetch(id ? `/ledger/accounts/${id}` : "/ledger/accounts", accountView, {
        method: id ? "PATCH" : "POST",
        body,
      }),
    id ? "Account saved" : "Account added",
    onDone,
  );

export const useLock = (onDone: () => void) =>
  useLedgerWrite(
    (through: string | null) =>
      apiFetch("/ledger/lock", lockView, { method: "PUT", body: { through } }),
    "Lock date saved",
    onDone,
  );
