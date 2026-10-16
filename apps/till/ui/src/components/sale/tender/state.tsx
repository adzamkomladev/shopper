import { useState } from "react";
import { formatGHS } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input/control";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { DraftTender, SaleActions, SaleSnapshot } from "../../../sale/types";

export function MomoState({
  tender,
  failureReason,
  onOtp,
  onRetry,
}: {
  tender: DraftTender | undefined;
  failureReason: string | null;
  onOtp: (otp: string) => void;
  onRetry: () => void;
}) {
  const [otp, setOtp] = useState("");
  if (!tender || tender.kind !== "momo") return null;
  if (tender.status === "otp")
    return (
      <div className="grid gap-2 rounded-md border p-3">
        <p className="text-sm font-medium">Enter the one-time code sent to the customer.</p>
        <Input
          aria-label="One-time code"
          inputMode="numeric"
          maxLength={10}
          touch
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
        />
        {failureReason && (
          <p className="text-sm text-destructive" role="alert">
            {failureReason}
          </p>
        )}
        <Button disabled={!/^\d{4,10}$/.test(otp)} onClick={() => onOtp(otp)} size="touch">
          Submit code
        </Button>
      </div>
    );
  const message = momoMessage(tender.status);
  if (!message) return null;
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
      role="status"
    >
      <span>{message}</span>
      {["failed", "expired"].includes(tender.status) && (
        <Button onClick={onRetry} size="touch" variant="outline">
          Retry payment
        </Button>
      )}
    </div>
  );
}

function momoMessage(status: DraftTender["status"]) {
  if (status === "pending") return "Waiting for customer approval";
  if (status === "confirmed") return "Mobile money confirmed";
  if (status === "expired") return "Mobile money request expired";
  if (status === "failed") return "Mobile money payment failed";
  return null;
}

export function ReceiptComplete({
  actions,
  receipt,
  active,
}: {
  actions: SaleActions;
  receipt: NonNullable<SaleSnapshot["receipt"]>;
  active: boolean;
}) {
  const shortcuts = useShortcuts(active ? { Enter: actions.newSale } : {});
  return (
    <section
      aria-label="Sale receipt"
      className="grid h-full min-w-0 content-center justify-items-center gap-5 rounded-lg border bg-card p-8 text-center md:col-span-5"
      ref={shortcuts}
    >
      <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Sale complete
      </p>
      <h2 className="text-2xl font-bold">{receipt.header.receiptNumber ?? "Receipt"}</h2>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="whitespace-nowrap text-xl font-semibold tabular-nums">
            {formatGHS(receipt.total)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Change due</dt>
          <dd className="whitespace-nowrap text-3xl font-bold tabular-nums">
            {formatGHS(receipt.change)}
          </dd>
        </div>
      </dl>
      <Button aria-keyshortcuts="Enter" onClick={actions.newSale} size="touch">
        New sale <Kbd className="pointer-coarse:inline-flex">Enter</Kbd>
      </Button>
    </section>
  );
}
