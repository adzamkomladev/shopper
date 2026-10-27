import { useState } from "react";
import { MailIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Input } from "@shopper/ui/components/input";
import { Kbd } from "@shopper/ui/components/kbd";
import { Label } from "@shopper/ui/components/label";
import { useEmailReceipt } from "../../../queries/transactions/detail";

export const EMAIL_BUTTON_ID = "transaction-email-receipt";

type Props = {
  saleId: string;
  /** A named customer: an empty address sends to the email on their record. */
  customerName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** The Email receipt button (`M`) and its dialog: the customer's own address, or one typed in. */
export function EmailReceipt({ saleId, customerName, open, onOpenChange }: Props) {
  const send = useEmailReceipt(saleId);
  const [error, setError] = useState<string>();
  return (
    <>
      <Button
        id={EMAIL_BUTTON_ID}
        variant="outline"
        onClick={() => onOpenChange(true)}
        aria-keyshortcuts="M"
      >
        <MailIcon aria-hidden />
        Email receipt
        <Kbd aria-hidden>M</Kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setError(undefined);
          onOpenChange(next);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(EMAIL_BUTTON_ID)?.focus();
          }}
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const typed = new FormData(event.currentTarget).get("email");
              const email = typeof typed === "string" ? typed.trim() : "";
              send.mutate(email || undefined, {
                onSuccess: () => onOpenChange(false),
                onError: (failure) => setError(failure.message),
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Email the receipt</DialogTitle>
              <DialogDescription>
                {customerName
                  ? `Leave the address empty to send it to ${customerName}'s email.`
                  : "Type the address to send the receipt to."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="receipt-email">Email address</Label>
              <Input
                id="receipt-email"
                name="email"
                type="email"
                autoComplete="email"
                required={!customerName}
                aria-invalid={!!error}
                aria-describedby={error ? "receipt-email-error" : undefined}
                autoFocus
              />
              {error && (
                <p id="receipt-email-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={send.isPending}>
                {send.isPending ? "Sending…" : "Send receipt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
