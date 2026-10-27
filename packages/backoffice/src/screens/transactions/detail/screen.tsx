import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { OfflineNote } from "../../../components/register/states";
import { TransactionAudit } from "../../../components/transactions/detail/audit";
import { EmailReceipt } from "../../../components/transactions/detail/email";
import { TransactionHeader } from "../../../components/transactions/detail/header";
import { TransactionLines } from "../../../components/transactions/detail/lines";
import { ReceiptMetadata, TransactionRefunds } from "../../../components/transactions/detail/meta";
import { TransactionTenders } from "../../../components/transactions/detail/tenders";
import { TransactionTotals } from "../../../components/transactions/detail/totals";
import { transactionQuery } from "../../../queries/transactions/detail";

/** One sale end to end: lines, totals, payments, refunds, fiscal documents and the audit trail. */
export function TransactionScreen() {
  const { saleId } = useParams({ from: "/_shop/transactions/$saleId" });
  const { data: sale } = useSuspenseQuery(transactionQuery(saleId));
  const navigate = useNavigate();
  const online = useOnline();
  const [emailing, setEmailing] = useState(false);
  const shortcuts = useShortcuts({
    ...(online && { M: () => setEmailing(true) }),
    // Not while the email dialog is open: Backspace there edits the address.
    ...(!emailing && { Backspace: () => void navigate({ to: "/transactions" }) }),
  });
  return (
    <div ref={shortcuts} className="flex flex-col gap-6">
      <TransactionHeader
        sale={sale}
        actions={
          online && (
            <EmailReceipt
              saleId={sale.id}
              customerName={sale.customer?.name ?? null}
              open={emailing}
              onOpenChange={setEmailing}
            />
          )
        }
      />
      {!online && <OfflineNote>Emailing the receipt needs a connection.</OfflineNote>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <TransactionLines lines={sale.lines} />
          <TransactionRefunds sale={sale} />
          <ReceiptMetadata sale={sale} />
          <TransactionAudit audit={sale.audit} />
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <TransactionTotals sale={sale} />
          <TransactionTenders sale={sale} />
        </div>
      </div>
    </div>
  );
}
