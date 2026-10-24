import { formatGHS, money } from "@shopper/money";
import type { PurchaseDetails } from "@shopper/sync/bridge";

export function DetailPayment({ purchase }: { purchase: PurchaseDetails }) {
  const confirmed =
    purchase.payment?.status === "confirmed" ||
    purchase.draft?.draft?.tenders.some(
      (tender) => tender.kind === "momo" && tender.status === "confirmed",
    );
  const hasPayment =
    purchase.payment ||
    purchase.receipt?.tenders.length ||
    purchase.sale?.tenders.length ||
    purchase.draft?.draft?.tenders.length;
  return (
    <section aria-label="Payment and tender" className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Payment and tender</h3>
        <p className="text-xs text-muted-foreground">
          {purchase.payment ? "Mobile money payment" : "Recorded tender details"}
        </p>
      </div>
      <div className="grid gap-3 p-4 text-sm">
        {confirmed && (
          <p
            className="rounded-md border border-primary/30 bg-primary/5 p-3 font-medium text-primary"
            role="status"
          >
            MoMo confirmed — not yet applied to a sale
          </p>
        )}
        {purchase.payment && (
          <>
            <Tender label="Mobile money" amount={money(purchase.payment.amount)} />
            <DetailRow label="Status" value={purchase.payment.status} />
            <DetailRow label="Network" value={`${purchase.payment.network.toUpperCase()} MoMo`} />
            <DetailRow label="Phone" value={purchase.payment.phone} />
            <DetailRow label="Reference" value={purchase.payment.reference} />
          </>
        )}
        {purchase.receipt?.tenders.map((tender, index) => (
          <div
            className="grid gap-2 border-b pb-3 last:border-0 last:pb-0"
            key={`${tender.kind}-${index}`}
          >
            <Tender label={tenderName(tender.kind)} amount={tender.amount} />
            {tender.phone && <DetailRow label="Phone" value={tender.phone} />}
            {tender.last4 && <DetailRow label="Card ending" value={tender.last4} />}
            {tender.approvalCode && <DetailRow label="Approval code" value={tender.approvalCode} />}
            {tender.reference && <DetailRow label="Reference" value={tender.reference} />}
          </div>
        ))}
        {!purchase.receipt &&
          purchase.sale?.tenders.map((tender) => (
            <Tender
              key={tender.id}
              label={tenderName(tender.kind)}
              amount={tender.amount}
              reference={tender.reference}
            />
          ))}
        {!purchase.receipt &&
          !purchase.sale &&
          purchase.draft?.draft?.tenders.map((tender) => (
            <Tender
              key={tender.id}
              label={tenderName(tender.kind)}
              amount={money(tender.amount)}
              reference={tender.reference ?? undefined}
              status={tender.status}
            />
          ))}
        {!hasPayment && (
          <p className="text-sm text-muted-foreground">No payment details are available.</p>
        )}
      </div>
    </section>
  );
}

function Tender({
  label,
  amount,
  reference,
  status,
}: {
  label: string;
  amount: number;
  reference?: string;
  status?: string;
}) {
  return (
    <div className="grid gap-2 rounded-md bg-muted/50 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">
          {label}
          {status ? ` · ${status}` : ""}
        </span>
        <span className="font-bold tabular-nums">{formatGHS(money(amount))}</span>
      </div>
      {reference && <DetailRow label="Reference" value={reference} />}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

const tenderNames = {
  cash: "Cash",
  momo: "Mobile money",
  card: "Card",
  credit: "On account",
  loyalty: "Points",
} as const;

function tenderName(kind: keyof typeof tenderNames) {
  return tenderNames[kind];
}
