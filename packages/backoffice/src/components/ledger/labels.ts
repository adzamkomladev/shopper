import type { AccountType, JournalSource } from "../../schemas/ledger/views";

export const TYPE_LABELS: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

export const SOURCE_LABELS: Record<JournalSource, string> = {
  sale: "Sale",
  refund: "Refund",
  credit: "Customer account",
  loyalty: "Points",
  shift: "Shift close",
  stock: "Stock",
  settlement: "Settlement",
  manual: "Manual",
  reversal: "Reversal",
};
