import { formatGHS, money } from "@shopper/money";
import type { PurchaseDetails } from "@shopper/sync/bridge";

export function DetailTotals({ purchase }: { purchase: PurchaseDetails }) {
  const receipt = purchase.receipt;
  const quote = purchase.draft?.quote.totals;
  return (
    <section aria-label="Order total" className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Order total</h3>
        <p className="text-xs text-muted-foreground">
          {receipt
            ? `Amounts captured on receipt ${receipt.header.receiptNumber ?? ""}`
            : "Register quote; no completed sale recorded"}
        </p>
      </div>
      {receipt && (
        <p className="px-4 pt-4 text-xs font-medium text-muted-foreground">
          Tax included in item prices
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm">
        {receipt ? (
          <>
            <AmountRow label="Subtotal before discounts" value={receipt.subtotal} />
            {receipt.discountTotal > 0 && (
              <AmountRow label="Discounts" value={receipt.discountTotal} prefix="−" />
            )}
            <AmountRow label="VAT" value={receipt.taxSummary.vat} />
            <AmountRow label="NHIL" value={receipt.taxSummary.nhil} />
            <AmountRow label="GETFund" value={receipt.taxSummary.getfund} />
            {receipt.taxSummary.covid > 0 && (
              <AmountRow label="COVID levy" value={receipt.taxSummary.covid} />
            )}
            {receipt.cashRounding !== 0 && (
              <AmountRow label="Cash rounding" value={receipt.cashRounding} />
            )}
            <TotalRow label="Total" value={receipt.total} />
            <AmountRow label="Paid" value={receipt.paid} />
            {receipt.change > 0 && <AmountRow label="Change" value={receipt.change} />}
          </>
        ) : (
          <>
            <AmountRow
              label={purchase.status === "voided" ? "Voided draft quote" : "Draft quote"}
              value={money(quote?.gross ?? purchase.total)}
            />
            {quote && (
              <>
                <AmountRow label="VAT" value={quote.vat} />
                <AmountRow label="NHIL" value={quote.nhil} />
                <AmountRow label="GETFund" value={quote.getfund} />
                {quote.covid > 0 && <AmountRow label="COVID levy" value={quote.covid} />}
              </>
            )}
          </>
        )}
      </dl>
    </section>
  );
}

function AmountRow({
  label,
  value,
  prefix = "",
}: {
  label: string;
  value: number;
  prefix?: string;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="justify-self-end whitespace-nowrap font-medium tabular-nums">
        {prefix}
        {formatGHS(money(value))}
      </dd>
    </>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="border-t pt-3 text-base font-bold">{label}</dt>
      <dd className="justify-self-end border-t pt-3 text-xl font-bold tabular-nums">
        {formatGHS(money(value))}
      </dd>
    </>
  );
}
