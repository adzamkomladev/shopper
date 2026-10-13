import { useRef } from "react";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Input } from "@shopper/ui/components/input";
import { Kbd } from "@shopper/ui/components/kbd";
import { Label } from "@shopper/ui/components/label";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { Revealed } from "./queries";

type Props = {
  revealed?: Revealed;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** Shows a setup link once, with the quickest way to copy it. Nothing here outlives the dialog's state. */
export function SetupLinkDialog({ revealed, open, onOpenChange, restoreFocus }: Props) {
  const copyRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  async function copy() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.link);
      toast.success("Link copied");
    } catch {
      // A shop on its local network is served over plain http, where the browser has no clipboard.
      inputRef.current?.select();
      toast.message("Press Ctrl+C to copy the selected link");
    }
  }
  const shortcuts = useShortcuts({ C: () => void copy() });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={shortcuts}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          copyRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Setup link ready</DialogTitle>
          <DialogDescription>
            Send this link to {revealed?.email ?? "them"}. It works once and stops working after 7
            days, or as soon as you make a new link.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="setup-link">Setup link</Label>
          <Input id="setup-link" ref={inputRef} readOnly value={revealed?.link ?? ""} />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Done</Button>
          </DialogClose>
          <Button ref={copyRef} onClick={() => void copy()}>
            <CopyIcon aria-hidden />
            Copy link
            <Kbd aria-hidden>C</Kbd>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
