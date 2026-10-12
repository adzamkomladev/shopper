import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@shopper/ui/components/sheet";
import { NewProductForm } from "./new-product-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opened the sheet: focus goes back to it, wherever the sheet was opened from. */
  addRef: React.RefObject<HTMLButtonElement | null>;
};

export function NewProductSheet({ open, onOpenChange, addRef }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          addRef.current?.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>New product</SheetTitle>
          <SheetDescription>Add the basics now. You can set prices next.</SheetDescription>
        </SheetHeader>
        <NewProductForm onCreated={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
