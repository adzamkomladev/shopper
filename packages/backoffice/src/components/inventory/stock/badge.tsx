import { Badge } from "@shopper/ui/components/badge";

/** Marks stock at or under its reorder level. The word, not only the colour, carries the meaning. */
export function LowBadge() {
  return <Badge className="border-warning-border bg-warning text-warning-foreground">Low</Badge>;
}

/** Marks stock under zero: more was sold than was counted, usually by two registers offline. */
export function NegativeBadge() {
  return <Badge variant="destructive">Negative</Badge>;
}
