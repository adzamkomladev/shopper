import { formatGHS, money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@shopper/ui/components/card";
import { Money } from "@shopper/ui/components/money";
import type { TransactionDetail } from "../../../schemas/transactions";
import { tenderLabel } from "../list/format";

const PROVIDERS: Record<string, string> = { paystack: "Paystack", hubtel: "Hubtel" };

/** How it was paid: each tender, and behind a MoMo tender its payment's reference, provider and state. */
export function TransactionTenders({ sale }: { sale: TransactionDetail }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-lg">Payment and tender</CardTitle>
        <CardDescription>
          {sale.tenders.length === 1 ? "One payment" : `${sale.tenders.length} payments`}
          {sale.change ? ` · change given ${formatGHS(money(sale.change))}` : ""}
        </CardDescription>
      </CardHeader>
      <div className="grid gap-3 p-4">
        {sale.tenders.map((tender, index) => (
          <section
            key={index}
            aria-label={tenderLabel(tender.kind)}
            className="grid gap-3 rounded-md bg-muted/50 p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {tenderLabel(tender.kind)}
                  {tender.last4 ? ` ending ${tender.last4}` : ""}
                </div>
                {tender.payment && (
                  <div className="text-xs text-muted-foreground">
                    {PROVIDERS[tender.payment.provider] ?? tender.payment.provider}
                    {tender.payment.network ? ` · ${tender.payment.network.toUpperCase()}` : ""}
                  </div>
                )}
              </div>
              <Money amount={money(tender.amount)} className="text-base font-semibold" />
            </div>
            {tender.payment && (
              <dl className="grid gap-2">
                <Fact label="Status">
                  <Badge variant="outline" className="capitalize">
                    {tender.payment.status}
                  </Badge>
                </Fact>
                <Fact label="MoMo reference">{tender.payment.reference}</Fact>
                {tender.payment.providerReference && (
                  <Fact label="Provider reference">{tender.payment.providerReference}</Fact>
                )}
              </dl>
            )}
            {!tender.payment && tender.reference && (
              <dl className="grid gap-2">
                <Fact label="Reference">{tender.reference}</Fact>
              </dl>
            )}
          </section>
        ))}
      </div>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-all text-right">{children}</dd>
    </div>
  );
}
