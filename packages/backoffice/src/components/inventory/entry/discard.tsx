import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@shopper/ui/components/alert/dialog";
import { SEARCH_ID } from "../../../lib/inventory/entry";

type Props = {
  open: boolean;
  /** "delivery" or "adjustment": what the person would lose. */
  what: string;
  onDiscard: () => void;
  onKeep: () => void;
};

/** Asks before a form with products on it is left. Keep editing puts focus back in the form. */
export function DiscardDialog({ open, what, onDiscard, onKeep }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onKeep()}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(SEARCH_ID)?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this {what}?</AlertDialogTitle>
          <AlertDialogDescription>
            The products you added haven't been saved, and leaving now loses them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
