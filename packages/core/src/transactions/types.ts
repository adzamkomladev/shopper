export type TransactionRow = {
  id: string;
  kind: "sale" | "payment";
  occurredAt: string;
  receiptNumber: string | null;
  branchId: string;
  cashierId: string;
  cashierName: string | null;
  customerId: string | null;
  customerName: string | null;
  total: string | number;
  status: "completed" | "refunded" | "pending";
  tenders: string[];
  items: number;
};
