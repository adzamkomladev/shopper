import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { FieldGroup } from "@shopper/ui/components/field";
import { SheetClose, SheetFooter } from "@shopper/ui/components/sheet";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { ID_LABELS } from "../../../lib/kyc/ids";
import { useKycActions } from "../../../queries/kyc/actions";
import { settingsQuery } from "../../../queries/settings/resource";
import { idFormSchema, type IdValues, type KycDetail } from "../../../schemas/kyc";
import type { KycSettingsView } from "../../../schemas/settings/kyc";
import { MOD_KEY } from "../../../lib/mod/key";
import { Kbd } from "@shopper/ui/components/kbd";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";
import { StartError, StepForm, useStepShortcut } from "./step";

type Props = { kase: KycDetail; onDone: (kase: KycDetail) => void };

const EMPTY: IdValues = { idType: "", idNumber: "", fullName: "" };

/** Step 3: the ID the approver will look at. Skip is offered only when the shop does not require one. */
export function IdStep(props: Props) {
  const settings = useQuery(settingsQuery("kyc"));
  if (settings.isError)
    return (
      <div className="flex flex-col items-start gap-3 px-4">
        <StartError message={settings.error.message} />
        <Button variant="outline" onClick={() => void settings.refetch()}>
          Try again
        </Button>
      </div>
    );
  if (!settings.data)
    return (
      <div
        className="flex flex-col gap-4 px-4"
        role="status"
        aria-busy="true"
        aria-label="Loading ID options"
      >
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  return <IdForm {...props} settings={settings.data} />;
}

function IdForm({ kase, onDone, settings }: Props & { settings: KycSettingsView }) {
  const online = useOnline();
  const { recordId, skipId } = useKycActions();
  const busy = recordId.isPending || skipId.isPending;
  const form = useForm({
    defaultValues: EMPTY,
    validators: { onSubmit: idFormSchema },
    onSubmit: ({ value }) =>
      recordId.mutate(
        {
          id: kase.id,
          body: {
            idType: value.idType,
            idNumber: value.idNumber.trim(),
            fullName: value.fullName.trim(),
          },
        },
        { onSuccess: onDone },
      ),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useStepShortcut(form, online && !busy);
  const error = recordId.error ?? skipId.error;
  const clearError = () => {
    if (recordId.isError) recordId.reset();
  };
  return (
    <StepForm shortcuts={shortcuts} form={form}>
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        <p className="text-sm text-muted-foreground">
          {settings.idRequired
            ? "This shop needs an ID document before a check can be approved."
            : "An ID is optional. Add one if the customer has it with them."}
        </p>
        <form.Field name="idType">
          {(field) => (
            <SelectField
              field={field}
              label="ID type"
              placeholder="Choose the type of ID"
              options={settings.idTypes.map((type) => ({ value: type, label: ID_LABELS[type] }))}
              autoFocus
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="idNumber">
          {(field) => (
            <TextField
              field={field}
              label="ID number"
              description="Only the last digits are kept, and the approver sees them hidden."
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="fullName">
          {(field) => (
            <TextField
              field={field}
              label="Full name on the ID"
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        {error && <StartError message={error.message} />}
      </FieldGroup>
      {!online && (
        <p className="px-4 text-sm text-muted-foreground">You're offline. Reconnect to save.</p>
      )}
      <SheetFooter className="flex-col-reverse sm:flex-row sm:justify-end">
        {settings.idRequired ? (
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={!online || busy}
            onClick={() => skipId.mutate({ id: kase.id }, { onSuccess: onDone })}
          >
            Skip, no ID
          </Button>
        )}
        <Button type="submit" disabled={!online || busy}>
          {recordId.isPending ? (
            "Saving…"
          ) : (
            <>
              Save ID
              <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
            </>
          )}
        </Button>
      </SheetFooter>
    </StepForm>
  );
}
