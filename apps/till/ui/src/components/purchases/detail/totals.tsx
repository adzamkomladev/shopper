import { add, formatGHS, money, sub } from "@shopper/money";
import type { PurchaseDetails } from "@shopper/sync/bridge";

export function DetailTotals({ purchase }: { purchase: PurchaseDetails }) {
  const receipt = purchase.receipt;
  const quote = purchase.draft?.quote.totals;
  const refunded = purchase.refunds.reduce(
    (sum, refund) => add(sum, money(refund.total)),
    money(0),
  );
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
      <dl className="grid grid-cols-2 gap-y-2 p-4 text-sm">
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
            {purchase.eligibility && (
              <AmountRow label="Refunds" prefix={refunded > 0 ? "−" : ""} value={refunded} />
            )}
            {refunded > 0 && (
              <AmountRow label="After refunds" value={sub(money(receipt.total), refunded)} />
            )}
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
    <div className="col-span-2 mt-1 flex items-baseline justify-between border-t pt-3">
      <dt className="text-base font-bold">{label}</dt>
      <dd className="text-xl font-bold tabular-nums">{formatGHS(money(value))}</dd>
    </div>
  );
}
