import { Badge } from "@shopper/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { statementDay } from "../../lib/statements/format";
import type { BillingView } from "../../schemas/billing";

const STATUS = {
  active: { label: "Active", variant: "default" },
  past_due: { label: "Payment due", variant: "secondary" },
  read_only: { label: "Read-only", variant: "destructive" },
} as const;

/** The subscription's state and when the next invoice is raised. */
export function SubscriptionSummary({
  subscription,
}: {
  subscription: BillingView["subscription"];
}) {
  if (!subscription)
    return (
      <Card>
        <CardHeader>
          <CardTitle>No subscription</CardTitle>
          <CardDescription>This organisation is not billed by Shopper.</CardDescription>
        </CardHeader>
      </Card>
    );
  const status = STATUS[subscription.status];
  return (
    <Card>
      <CardHeader>
        <CardDescription>Subscription</CardDescription>
        <CardTitle className="flex items-center gap-3">
          Shopper <Badge variant={status.variant}>{status.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Next invoice on {statementDay(subscription.nextInvoiceOn)}. GH₵ 550 a store with its first
        register, 300 each for the 2nd and 3rd, and 250 from the 4th.
      </CardContent>
    </Card>
  );
}
