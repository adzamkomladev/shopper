import { Badge } from "@shopper/ui/components/badge";
import { STATUS_LABELS } from "../../../lib/inventory/takes";
import type { TakeSummary } from "../../../queries/inventory/types";

const VARIANT = { open: "default", posted: "secondary", cancelled: "outline" } as const;

/** Open, Posted or Cancelled: the word carries the status, the badge colour backs it up. */
export function TakeStatus({ status }: { status: TakeSummary["status"] }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}
