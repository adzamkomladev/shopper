import { CircleIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { varianceLabel } from "../../../lib/shifts/format";

/** Short if any tender came up short, else Over if any came up over, else Balanced. */
export function VarianceBadge({ short, over }: { short: number; over: number }) {
  const label = varianceLabel(short < 0 ? short : over);
  if (short < 0) return <Badge variant="destructive">{label}</Badge>;
  if (over > 0)
    return (
      <Badge className="border-warning-border bg-warning text-warning-foreground">{label}</Badge>
    );
  return (
    <Badge variant="outline">
      <CircleIcon aria-hidden className="fill-success text-success" />
      {label}
    </Badge>
  );
}
