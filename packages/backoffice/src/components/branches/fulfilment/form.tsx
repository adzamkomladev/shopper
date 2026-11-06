import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@shopper/ui/components/field";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../../admin/form/sheet";
import { SelectField } from "../../fields/select";
import { SwitchField } from "../../fields/switch";
import { TextField } from "../../fields/text";
import { focusFirstInvalid } from "../../../lib/focus";
import { fulfilmentQuery, useSaveFulfilment } from "../../../queries/fulfilment";
import {
  fulfilmentForm,
  fulfilmentValues,
  SLOT_OPTIONS,
  type FulfilmentView,
} from "../../../schemas/fulfilment";

type Props = { branchId: string; canWrite: boolean; onSaved: () => void };

/** The branch's online ordering in a sheet: loading, a failed read with retry, then the form. */
export function FulfilmentPanel({ branchId, canWrite, onSaved }: Props) {
  const saved = useQuery(fulfilmentQuery(branchId));
  if (saved.isPending) return <FulfilmentSkeleton />;
  if (saved.isError)
    return (
      <div className="flex flex-col gap-3 px-4">
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>{saved.error.message}</AlertDescription>
        </Alert>
        <Button variant="outline" className="self-start" onClick={() => void saved.refetch()}>
          Try again
        </Button>
      </div>
    );
  return (
    <FulfilmentForm branchId={branchId} saved={saved.data} canWrite={canWrite} onSaved={onSaved} />
  );
}

function FulfilmentForm({ branchId, saved, canWrite, onSaved }: Props & { saved: FulfilmentView }) {
  const online = useOnline();
  const save = useSaveFulfilment(branchId, onSaved);
  const form = useForm({
    defaultValues: fulfilmentValues(saved),
    validators: { onSubmit: fulfilmentForm },
    onSubmit: ({ value }) => save.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (canWrite && online && !save.isPending) void form.handleSubmit();
    },
  });
  const clearError = () => {
    if (save.isError) save.reset();
  };
  return (
    <form
      ref={shortcuts}
      noValidate
      aria-label="Online orders"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <fieldset disabled={!canWrite} className="min-h-0 flex-1 overflow-y-auto">
        <FieldGroup className="px-4">
          <FieldSet>
            <FieldLegend>How shoppers get their order</FieldLegend>
            <FieldGroup className="gap-4">
              <form.Field name="pickup">
                {(field) => (
                  <SwitchField
                    field={field}
                    label="Pickup"
                    description="Shoppers collect their order at this branch."
                    onChange={clearError}
                  />
                )}
              </form.Field>
              <form.Field name="delivery">
                {(field) => (
                  <SwitchField
                    field={field}
                    label="Delivery"
                    description="The branch takes the order to the shopper's address."
                    onChange={clearError}
                  />
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.delivery}>
                {(delivery) =>
                  delivery && (
                    <form.Field name="deliveryFee">
                      {(field) => (
                        <TextField
                          field={field}
                          label="Delivery fee (GH₵)"
                          description="One flat fee for every delivery, VAT included."
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="15.00"
                          onChange={clearError}
                        />
                      )}
                    </form.Field>
                  )
                }
              </form.Subscribe>
            </FieldGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend>When orders are ready</FieldLegend>
            <FieldDescription>
              Shoppers pick a slot between these times, up to three days ahead.
            </FieldDescription>
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="opens">
                {(field) => (
                  <TextField field={field} label="From" type="time" onChange={clearError} />
                )}
              </form.Field>
              <form.Field name="closes">
                {(field) => (
                  <TextField field={field} label="Until" type="time" onChange={clearError} />
                )}
              </form.Field>
            </div>
            <form.Field name="slotMinutes">
              {(field) => (
                <SelectField
                  field={field}
                  label="Slot length"
                  options={SLOT_OPTIONS}
                  onChange={clearError}
                />
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="slotCapacity">
                {(field) => (
                  <TextField
                    field={field}
                    label="Orders per slot"
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={clearError}
                  />
                )}
              </form.Field>
              <form.Field name="leadMinutes">
                {(field) => (
                  <TextField
                    field={field}
                    label="Notice (minutes)"
                    description="The soonest a slot can start."
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={clearError}
                  />
                )}
              </form.Field>
            </div>
          </FieldSet>
          {save.error && (
            <Alert variant="destructive">
              <CircleAlertIcon aria-hidden />
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </fieldset>
      {canWrite ? (
        <FormFooter label="Save online orders" pending={save.isPending} online={online} />
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          You can view these settings. Ask an owner for permission to change them.
        </p>
      )}
    </form>
  );
}

/** The form's own boxes: two switches, the hours pair, the slot select and the last pair. */
function FulfilmentSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading online orders" className="flex flex-col gap-6 px-4">
      <Skeleton className="h-5 w-48" />
      {[0, 1].map((row) => (
        <div key={row} className="flex gap-3">
          <Skeleton className="h-5 w-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      ))}
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <Skeleton className="h-14" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    </div>
  );
}
