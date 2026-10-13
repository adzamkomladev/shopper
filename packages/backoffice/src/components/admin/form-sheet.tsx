import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shopper/ui/components/sheet";
import { MOD_KEY } from "../../lib/mod-key";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Moves focus to whatever opened the sheet, which is gone or elsewhere after a save. */
  restoreFocus: () => void;
  children: React.ReactNode;
  className?: string;
};

/** A right-hand sheet that hands focus back when it closes. */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  restoreFocus,
  children,
  className,
}: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={className ?? "sm:max-w-md"}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

const OFFLINE_NOTE_ID = "save-offline-note";

type FooterProps = { label: string; pendingLabel?: string; pending: boolean; online: boolean };

/** Cancel and the one submit button, which says why it is disabled when the device is offline. */
export function FormFooter({ label, pendingLabel = "Saving…", pending, online }: FooterProps) {
  return (
    <>
      {!online && (
        <p id={OFFLINE_NOTE_ID} className="px-4 text-sm text-muted-foreground">
          You're offline. Reconnect to save.
        </p>
      )}
      <SheetFooter className="flex-col-reverse sm:flex-row sm:justify-end">
        <SheetClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </SheetClose>
        <Button
          type="submit"
          disabled={!online || pending}
          aria-describedby={online ? undefined : OFFLINE_NOTE_ID}
        >
          {pending ? (
            pendingLabel
          ) : (
            <>
              {label}
              <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
            </>
          )}
        </Button>
      </SheetFooter>
    </>
  );
}
