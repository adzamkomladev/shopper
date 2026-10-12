import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
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
import { SelectField } from "../../components/select-field";
import { TextField } from "../../components/text-field";
import { focusFirstInvalid } from "../../lib/focus";
import { MOD_KEY } from "../../lib/mod-key";
import {
  ALL_BRANCHES,
  failureFor,
  emptyPrice,
  failureMessage,
  PRICE_FIELDS,
  priceSchemas,
  type PriceMode,
} from "./forms";
import { branchesQuery, useSavePrice } from "./queries";

const OFFLINE_NOTE_ID = "price-offline-note";
const COPY = {
  set: {
    title: "Set price",
    description: "The new price applies straight away. The old one stays in the history.",
  },
  schedule: {
    title: "Schedule price",
    description:
      "The price applies between these times (Ghana time), then the previous price returns.",
  },
} as const;

type Props = {
  productId: string;
  mode: PriceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

export function PriceDialog({ productId, mode, open, onOpenChange, restoreFocus }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{COPY[mode].title}</DialogTitle>
          <DialogDescription>{COPY[mode].description}</DialogDescription>
        </DialogHeader>
        <PriceForm productId={productId} mode={mode} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type FormProps = { productId: string; mode: PriceMode; onSaved: () => void };

function PriceForm({ productId, mode, onSaved }: FormProps) {
  const online = useOnline();
  const { data: branches = [] } = useQuery(branchesQuery());
  const save = useSavePrice(productId, mode, onSaved);
  const form = useForm({
    defaultValues: emptyPrice,
    validators: { onSubmit: priceSchemas[mode] },
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
  const clearError = () => {
    if (save.isError) save.reset();
  };
  const failure = (name: string) => failureFor(save.error, name);
  const branchOptions = [
    { value: ALL_BRANCHES, label: "All branches" },
    ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
  ];
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
        <form.Field name="amount">
          {(field) => (
            <TextField
              field={field}
              label="Amount"
              description="In cedis, for example 12.50."
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              serverError={failure("amount")}
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="branchId">
          {(field) => <SelectField field={field} label="Branch" options={branchOptions} />}
        </form.Field>
        {mode === "schedule" && (
          <>
            <form.Field name="startsAt">
              {(field) => (
                <TextField
                  field={field}
                  label="Starts"
                  type="datetime-local"
                  serverError={failure("startsAt")}
                  onChange={clearError}
                />
              )}
            </form.Field>
            <form.Field name="endsAt">
              {(field) => (
                <TextField
                  field={field}
                  label="Ends"
                  type="datetime-local"
                  serverError={failure("endsAt")}
                  onChange={clearError}
                />
              )}
            </form.Field>
          </>
        )}
        <form.Field name="reason">
          {(field) => (
            <TextField
              field={field}
              label="Reason"
              description="Kept in the price history, for example Supplier raised cost."
              autoComplete="off"
              serverError={failure("reason")}
              onChange={clearError}
            />
          )}
        </form.Field>
        {save.error && !failureFor(save.error, ...PRICE_FIELDS) && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{failureMessage(save.error)}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      {!online && (
        <p id={OFFLINE_NOTE_ID} className="text-sm text-muted-foreground">
          You're offline. Reconnect to save this price.
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
              {COPY[mode].title}
              <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
