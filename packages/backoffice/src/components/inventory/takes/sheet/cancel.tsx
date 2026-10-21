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
import { CANCEL_ID } from "../../../../lib/inventory/takes";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void };

/** Asks before a take is cancelled: its counts stay on the take, but nothing is posted. */
export function CancelTakeDialog({ open, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        // There is no trigger element for Radix to return to, so focus goes back to the button that opened this.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(CANCEL_ID)?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this stock take?</AlertDialogTitle>
          <AlertDialogDescription>
            The counts you entered stay on the take, but nothing is posted and stock on hand does
            not change. You can start a new take afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep counting</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancel take</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
