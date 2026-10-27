import { Badge } from "@shopper/ui/components/badge";

const LABELS = { completed: "Completed", refunded: "Refunded", pending: "Pending MoMo" } as const;

/** A sale's state in words, never colour alone. */
export function StatusBadge({ status }: { status: keyof typeof LABELS }) {
  if (status === "completed") return <Badge>{LABELS.completed}</Badge>;
  if (status === "refunded") return <Badge variant="outline">{LABELS.refunded}</Badge>;
  return <Badge variant="secondary">{LABELS.pending}</Badge>;
}
