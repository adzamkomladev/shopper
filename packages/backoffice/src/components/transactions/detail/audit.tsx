import { Card, CardDescription, CardHeader, CardTitle } from "@shopper/ui/components/card";
import { auditTime, commandLabel } from "../../../lib/audit/diff";
import type { TransactionDetail } from "../../../schemas/transactions";

/** Every recorded change to the sale, its refunds and its payments, oldest first. */
export function TransactionAudit({ audit }: { audit: TransactionDetail["audit"] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-lg">Audit trail</CardTitle>
        <CardDescription>The sale, its refunds and its payments, oldest first</CardDescription>
      </CardHeader>
      {audit.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ol className="grid divide-y text-sm">
          {audit.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
            >
              <span className="font-medium">{commandLabel(entry.command)}</span>
              <span className="text-muted-foreground">
                {entry.actorName ?? "System"} ·{" "}
                <time dateTime={entry.at}>{auditTime(entry.at)}</time>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
