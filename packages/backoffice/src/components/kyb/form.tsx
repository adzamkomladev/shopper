import { useForm } from "@tanstack/react-form";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup, FieldLegend, FieldSet } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../lib/focus";
import { editable, emptyDirector, kybValues } from "../../lib/kyb/values";
import { MOD_KEY } from "../../lib/mod/key";
import { useSaveKyb } from "../../queries/kyb";
import { kybFormSchema, type KybView } from "../../schemas/kyb";
import { SelectField } from "../fields/select";
import { TextField } from "../fields/text";
import { UploadField } from "./upload";
import { SaveError } from "./status";

/** `banks` is undefined while the list loads and null when it failed to. */
type Props = { view: KybView; banks: { name: string; code: string }[] | undefined | null };

const DOCUMENTS = [
  { kind: "registration_certificate", label: "Registration certificate" },
  { kind: "tin_certificate", label: "TIN certificate" },
] as const;

/** The business, where payouts go, its directors' Ghana Cards and its certificates; Mod+Enter submits. */
export function KybForm({ view, banks }: Props) {
  const online = useOnline();
  const save = useSaveKyb();
  const open = editable(view.status);
  const form = useForm({
    defaultValues: kybValues(view),
    validators: { onSubmit: kybFormSchema },
    onSubmit: ({ value }) => save.mutate({ values: value, submit: true }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const ready = open && online && !save.isPending;
  const shortcuts = useShortcuts({ "Mod+Enter": () => ready && void form.handleSubmit() });
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <fieldset disabled={!open} className="flex flex-col gap-8">
        <FieldSet>
          <FieldLegend>Business</FieldLegend>
          <FieldGroup>
            <form.Field name="businessName">
              {(field) => (
                <TextField field={field} label="Registered name" autoComplete="organization" />
              )}
            </form.Field>
            <form.Field name="registrationNumber">
              {(field) => (
                <TextField
                  field={field}
                  label="Registration number"
                  description="From the Office of the Registrar of Companies, as on the certificate."
                />
              )}
            </form.Field>
            <form.Field name="tin">
              {(field) => (
                <TextField
                  field={field}
                  label="Business TIN"
                  description="A letter and ten digits."
                />
              )}
            </form.Field>
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Payouts</FieldLegend>
          <FieldGroup>
            <form.Field name="settlementBank">
              {(field) => (
                <SelectField
                  field={field}
                  label="Bank or mobile money"
                  placeholder={
                    banks
                      ? "Choose where payouts go"
                      : banks === null
                        ? "Banks didn't load"
                        : "Loading banks…"
                  }
                  options={(banks ?? []).map((bank) => ({ value: bank.code, label: bank.name }))}
                />
              )}
            </form.Field>
            <form.Field name="settlementAccount">
              {(field) => (
                <TextField
                  field={field}
                  label="Account or wallet number"
                  inputMode="numeric"
                  autoComplete="off"
                />
              )}
            </form.Field>
          </FieldGroup>
        </FieldSet>
        <form.Field name="directors" mode="array">
          {(directors) => (
            <FieldSet>
              <FieldLegend>Directors</FieldLegend>
              {directors.state.value.map((_, index) => (
                <FieldGroup key={index} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Director {index + 1}</h3>
                    {directors.state.value.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => directors.removeValue(index)}
                      >
                        <Trash2Icon aria-hidden />
                        Remove director {index + 1}
                      </Button>
                    )}
                  </div>
                  <form.Field name={`directors[${index}].name`}>
                    {(field) => <TextField field={field} label="Full name" />}
                  </form.Field>
                  <form.Field name={`directors[${index}].ghanaCard`}>
                    {(field) => (
                      <TextField
                        field={field}
                        label="Ghana Card number"
                        description="As printed: GHA-123456789-0."
                        autoComplete="off"
                      />
                    )}
                  </form.Field>
                  <form.Field name={`directors[${index}].cardExpiresOn`}>
                    {(field) => <TextField field={field} type="date" label="Card expires on" />}
                  </form.Field>
                  <form.Field name={`directors[${index}].cardAssetId`}>
                    {(field) => (
                      <UploadField field={field} label="Scan of the card" disabled={!open} />
                    )}
                  </form.Field>
                </FieldGroup>
              ))}
              {directors.state.meta.errors[0] && (
                <p className="text-sm text-destructive">{directors.state.meta.errors[0].message}</p>
              )}
              {directors.state.value.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => directors.pushValue(emptyDirector)}
                >
                  <PlusIcon aria-hidden />
                  Add a director
                </Button>
              )}
            </FieldSet>
          )}
        </form.Field>
        <FieldSet>
          <FieldLegend>Certificates</FieldLegend>
          {DOCUMENTS.map((document) => (
            <FieldGroup key={document.kind} className="rounded-lg border p-4">
              <form.Field name={`${document.kind}.assetId`}>
                {(field) => <UploadField field={field} label={document.label} disabled={!open} />}
              </form.Field>
              <form.Field name={`${document.kind}.expiresOn`}>
                {(field) => (
                  <TextField
                    field={field}
                    type="date"
                    label={`${document.label} expires on`}
                    description="Leave empty if it does not expire."
                  />
                )}
              </form.Field>
            </FieldGroup>
          ))}
        </FieldSet>
      </fieldset>
      {open && (
        <div className="flex flex-col gap-3">
          <SaveError error={save.error?.message} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!ready}>
              {save.isPending ? "Sending…" : "Submit for review"}
              <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!ready}
              onClick={() => save.mutate({ values: form.state.values, submit: false })}
            >
              Save draft
            </Button>
          </div>
          {!online && (
            <p role="status" className="text-sm text-muted-foreground">
              You're offline. Reconnect to save.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
