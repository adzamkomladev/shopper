import { formatGHS, money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Card, CardHeader, CardTitle } from "@shopper/ui/components/card";
import type { TransactionDetail } from "../../../schemas/transactions";
import { tenderLabel } from "../list/format";
import { dateTimeLabel } from "./format";

/** The receipt's identifiers and its fiscal documents (the sale's invoice, each refund's credit note). */
export function ReceiptMetadata({ sale }: { sale: TransactionDetail }) {
  const invoice = sale.fiscal.find((doc) => !doc.refundId);
  const rows = [
    ["Receipt number", sale.receiptNumber],
    ["Transaction ID", sale.id],
    ["Register", sale.deviceId.slice(0, 8)],
    [
      "Fiscal document",
      invoice ? (invoice.invoiceNumber ?? "Waiting for the SDC") : "Not fiscalised",
    ],
    ...(invoice?.sdcId ? [["SDC ID", invoice.sdcId]] : []),
    ...(invoice?.signedAt ? [["Signed", dateTimeLabel(invoice.signedAt)]] : []),
  ];
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-lg">Receipt metadata</CardTitle>
      </CardHeader>
      <dl className="grid gap-3 p-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 font-medium break-all text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Each refund against the sale, with its credit note and any MoMo refund sent back to the wallet. */
export function TransactionRefunds({ sale }: { sale: TransactionDetail }) {
  if (!sale.refunds.length) return null;
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-lg">Refunds</CardTitle>
      </CardHeader>
      <ul className="grid divide-y text-sm">
        {sale.refunds.map((refund) => (
          <li key={refund.id} className="grid gap-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">
                {refund.creditNoteNumber ? `Credit note ${refund.creditNoteNumber}` : "Refund"}
              </span>
              <span className="font-semibold tabular-nums">{formatGHS(money(refund.total))}</span>
            </div>
            <span className="text-muted-foreground">
              {dateTimeLabel(refund.occurredAt)} · {tenderLabel(refund.tenderKind)}
              {refund.reason ? ` · ${refund.reason}` : ""}
            </span>
            {refund.providerRefunds.map((sent, index) => (
              <span key={index} className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={sent.status === "failed" ? "destructive" : "outline"}
                  className="capitalize"
                >
                  MoMo refund {sent.status}
                </Badge>
                {sent.reason && <span className="text-muted-foreground">{sent.reason}</span>}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}
