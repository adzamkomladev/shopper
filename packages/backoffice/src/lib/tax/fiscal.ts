import type { FiscalRow, FiscalSegment } from "../../schemas/tax/fiscal";

/** The dashboard's segments in tab order; each tab's key is its position (1 to 5). */
export const FISCAL_SEGMENTS: { value: FiscalSegment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "dead", label: "Dead-lettered" },
];

export const FISCAL_STATUS: Record<
  FiscalRow["status"],
  { label: string; variant: "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Pending", variant: "outline" },
  submitted: { label: "Sending", variant: "outline" },
  accepted: { label: "Accepted", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
  dead: { label: "Dead-lettered", variant: "destructive" },
};

export const FISCAL_KIND = { invoice: "Invoice", credit_note: "Credit note" } as const;

/** A shop time to the minute, "2026-10-24 14:05" (shop time is UTC). */
export const fiscalTime = (iso: string) => iso.slice(0, 16).replace("T", " ");
