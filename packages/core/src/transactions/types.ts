export type TransactionRow = {
  id: string;
  kind: "sale" | "payment" | "order";
  occurredAt: string;
  receiptNumber: string | null;
  branchId: string;
  cashierId: string | null;
  cashierName: string | null;
  customerId: string | null;
  customerName: string | null;
  total: string | number;
  status: "completed" | "refunded" | "pending";
  tenders: string[];
  items: number;
};
