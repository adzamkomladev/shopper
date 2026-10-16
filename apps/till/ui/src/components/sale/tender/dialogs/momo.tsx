import { useState } from "react";
import { formatGHS, type Money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Input } from "@shopper/ui/components/input/control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";

export function MomoDialog({
  open,
  amount,
  offline,
  onOpenChange,
  onReturnFocus,
  onSubmit,
}: {
  open: boolean;
  amount: Money;
  offline: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
  onSubmit: (phone: string, network: "mtn" | "telecel" | "airteltigo") => void;
}) {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<"mtn" | "telecel" | "airteltigo">("mtn");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="momo-payment-help"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Mobile money payment</DialogTitle>
          <DialogDescription id="momo-payment-help">
            Request payment from the customer’s phone. The amount must be in whole pesewas.
          </DialogDescription>
        </DialogHeader>
        <p className="text-2xl font-semibold tabular-nums">{formatGHS(amount)}</p>
        <label className="grid gap-2 text-sm font-medium">
          Phone number
          <Input
            autoFocus
            autoComplete="tel"
            className="min-h-12"
            inputMode="tel"
            touch
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Network
          <Select
            value={network}
            onValueChange={(value: string) => setNetwork(value as typeof network)}
          >
            <SelectTrigger aria-label="Network" className="min-h-12" size="touch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="min-h-12" value="mtn">
                MTN
              </SelectItem>
              <SelectItem className="min-h-12" value="telecel">
                Telecel
              </SelectItem>
              <SelectItem className="min-h-12" value="airteltigo">
                AirtelTigo
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
        {offline && (
          <p className="text-sm text-destructive">Mobile money needs an internet connection.</p>
        )}
        <DialogFooter>
          <Button
            className="min-h-12"
            disabled={offline || !/^(?:0\d{9}|\+233\d{9})$/.test(phone)}
            onClick={() => onSubmit(phone, network)}
            size="touch"
          >
            Request payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
