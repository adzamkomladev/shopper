import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
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
import { FieldGroup } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { TextField } from "../../../fields/text";
import { focusFirstInvalid } from "../../../../lib/focus";
import { MOD_KEY } from "../../../../lib/mod/key";
import { levelText, reorderSchema } from "../../../../schemas/inventory/reorder";
import { useSaveReorder } from "../../../../queries/inventory/stock";
import type { StockProduct } from "../../../../queries/inventory/types";

const OFFLINE_NOTE_ID = "reorder-offline-note";

type Props = {
  product: StockProduct;
  branchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

export function ReorderDialog({ product, branchId, open, onOpenChange, restoreFocus }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit reorder level</DialogTitle>
          <DialogDescription>
            {product.name} is flagged as low, and the branch's alert phones are texted, when it
            falls to this level. Leave it empty to remove the level.
          </DialogDescription>
        </DialogHeader>
        <ReorderForm product={product} branchId={branchId} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type FormProps = { product: StockProduct; branchId: string; onSaved: () => void };

function ReorderForm({ product, branchId, onSaved }: FormProps) {
  const online = useOnline();
  const save = useSaveReorder(branchId, product.productId, onSaved);
  const form = useForm({
    defaultValues: { level: levelText(product.levelThousandths) },
    validators: { onSubmit: reorderSchema },
    onSubmit: ({ value }) => {
      if (online) save.mutate(value);
    },
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) void form.handleSubmit();
    },
  });
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="level">
          {(field) => (
            <TextField
              field={field}
              label="Reorder level"
              description={`In ${product.baseUnit}, for example 12 or 2.5.`}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              onChange={() => save.isError && save.reset()}
            />
          )}
        </form.Field>
        {save.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      {!online && (
        <p id={OFFLINE_NOTE_ID} className="text-sm text-muted-foreground">
          You're offline. Reconnect to save this level.
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={!online || save.isPending}
          aria-describedby={online ? undefined : OFFLINE_NOTE_ID}
        >
          {save.isPending ? (
            "Saving…"
          ) : (
            <>
              Save level
              <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
