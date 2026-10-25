import { CircleCheck, Eye, EyeOff, Loader2, Printer } from "lucide-react";
import { cn } from "cn";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { PurchaseDetails, ReceiptDelivery } from "@shopper/sync/bridge";
import {
  digitalCopyText,
  deliveryText,
  fiscalText,
  reprintBlock,
} from "../../../purchases/delivery";
import type { PurchaseOutput, ReprintFeedback } from "../../../sale/types";
import { ReceiptPreview } from "./preview";

type Props = {
  purchase: PurchaseDetails;
  delivery: ReceiptDelivery;
  output: PurchaseOutput | null;
  reprint: ReprintFeedback | null;
  previewing: boolean;
  onReprint: () => void;
  onPreview: () => void;
};

export function DetailReceipt({ purchase, delivery, output, reprint, previewing, ...on }: Props) {
  const receipt = purchase.receipt;
  const failed = !!delivery.printError;
  return (
    <section aria-label="Receipt metadata" className="min-w-0 rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Receipt metadata</h3>
      </div>
      <dl className="grid gap-2 p-4 text-sm">
        <Row label="Receipt number" value={purchase.receiptNumber ?? "Not numbered"} />
        {receipt && <Row label="Register / cashier" value={registerLine(receipt)} />}
        <Row danger={failed} label="Receipt delivery" value={deliveryText(delivery)} />
        <Row label="Digital copy" value={digitalCopyText(delivery)} />
        {receipt && fiscalText(receipt) && <Row label="E-VAT" value={fiscalText(receipt)!} />}
      </dl>
      <div className="grid grid-cols-1 gap-2 px-4 pb-4">
        <ReprintButton
          className="w-full"
          label="Reprint receipt"
          onClick={on.onReprint}
          output={output}
          reprint={reprint}
        />
        <ReprintNotice reprint={reprint} output={output} />
        {receipt && (
          <Button
            aria-controls="receipt-preview"
            aria-expanded={previewing}
            aria-keyshortcuts="Alt+V"
            onClick={on.onPreview}
            size="touch"
            type="button"
            variant="ghost"
          >
            {previewing ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {previewing ? "Hide preview" : "Preview receipt"}{" "}
            <Kbd className="max-sm:hidden">Alt+V</Kbd>
          </Button>
        )}
        {receipt && output && previewing && (
          <ReceiptPreview id="receipt-preview" paperMm={output.paperMm} receipt={receipt} />
        )}
      </div>
    </section>
  );
}

/** The one Reprint action: the same button in the header and in the card, with the reason when it cannot run. */
export function ReprintButton({
  output,
  reprint,
  onClick,
  label,
  className,
}: {
  output: PurchaseOutput | null;
  reprint: ReprintFeedback | null;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  const running = reprint?.status === "running";
  const blocked = reprintBlock(output);
  return (
    <Button
      aria-describedby={blocked ? "reprint-reason" : undefined}
      // While it prints the button is aria-disabled, not disabled, so keyboard focus stays on it.
      aria-disabled={running || undefined}
      aria-keyshortcuts="Alt+R"
      className={cn("aria-disabled:opacity-50", className)}
      disabled={!!blocked}
      onClick={onClick}
      size="touch"
      type="button"
      variant="outline"
    >
      {running ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <Printer aria-hidden="true" />
      )}
      {running ? "Printing…" : label} <Kbd className="max-sm:hidden">Alt+R</Kbd>
    </Button>
  );
}

function ReprintNotice({
  reprint,
  output,
}: {
  reprint: ReprintFeedback | null;
  output: PurchaseOutput | null;
}) {
  const blocked = reprintBlock(output);
  if (blocked)
    return (
      <p className="text-xs text-muted-foreground" id="reprint-reason">
        {blocked}
        {output?.printer === "unconfigured" && (
          <>
            {" "}
            <Kbd className="max-sm:hidden">Alt+T</Kbd>
          </>
        )}
      </p>
    );
  if (reprint?.status === "failed")
    return (
      <p className="text-sm text-destructive" role="alert">
        {reprint.message}
      </p>
    );
  if (reprint?.status === "done")
    return (
      <p className="flex items-center gap-2 text-sm" role="status">
        <CircleCheck aria-hidden="true" className="size-4 text-success" />
        Receipt sent to the printer
      </p>
    );
  return null;
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 text-right font-medium ${danger ? "text-destructive" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

const registerLine = (receipt: NonNullable<PurchaseDetails["receipt"]>) =>
  `${receipt.header.device} · ${receipt.header.cashier}`;
