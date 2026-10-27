import { formatGHS, money } from "@shopper/money";
import { Card, CardContent, CardHeader, CardTitle } from "@shopper/ui/components/card";
import { Money } from "@shopper/ui/components/money";
import { formatQuantity } from "@shopper/utils";
import type { DashboardView } from "../../../schemas/reports/views";

/** Figma 339:9672's side card, holding the day's best sellers and how customers paid. */
export function DaySide({ top, tenders }: Pick<DashboardView, "top" | "tenders">) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Top products</CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing sold yet.</p>
        ) : (
          <ol className="flex flex-col divide-y">
            {top.map((product) => (
              <li
                key={product.productId}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatQuantity(product.quantity)} sold
                  </span>
                </span>
                <Money amount={money(product.netSales)} className="shrink-0 tabular-nums" />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      <CardHeader className="border-t pt-4">
        <CardTitle>Tender mix</CardTitle>
      </CardHeader>
      <CardContent>
        {tenders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tenders.map((tender) => (
              <li key={tender.kind} className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium">{tender.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatGHS(money(tender.net))} · {(tender.shareBps / 100).toFixed(1)}%
                  </span>
                </span>
                <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, tender.shareBps / 100))}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
