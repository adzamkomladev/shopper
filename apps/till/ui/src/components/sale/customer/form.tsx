import type { ComponentProps } from "react";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import type { CustomerForm } from "../../../hooks/sale/customer/types";
import type { CustomerField } from "../../../schemas/customer";
import { optionId, resultsId } from "./results";

type TextProps = {
  form: CustomerForm;
  field: CustomerField;
  label: string;
  hint?: string;
} & Pick<ComponentProps<typeof Input>, "autoFocus" | "inputMode" | "maxLength" | "role">;

/** One labelled text field whose error sits under it and is read out with it. */
function TextField({ form, field, label, hint, ...input }: TextProps) {
  const problem = form.problems[field];
  const describedBy = [hint && `customer-${field}-hint`, problem && `customer-${field}-error`];
  return (
    <Field data-invalid={problem ? "true" : undefined}>
      <FieldLabel htmlFor={`customer-${field}`}>{label}</FieldLabel>
      <Input
        {...input}
        aria-describedby={describedBy.filter(Boolean).join(" ") || undefined}
        aria-invalid={problem ? true : undefined}
        autoComplete="off"
        id={`customer-${field}`}
        name={field}
        onChange={(event) => form.change({ [field]: event.target.value })}
        touch
        value={form.draft[field]}
      />
      {hint && <FieldDescription id={`customer-${field}-hint`}>{hint}</FieldDescription>}
      {problem && <FieldError id={`customer-${field}-error`}>{problem}</FieldError>}
    </Field>
  );
}

/** The number to look up; once a customer is being edited it is an ordinary field. */
export function PhoneField({ form }: { form: CustomerForm }) {
  const { problems, draft, customers, active, editing } = form;
  const problem = problems.phone;
  const listed = customers.length > 0;
  return (
    <Field data-invalid={problem ? "true" : undefined}>
      <FieldLabel htmlFor="customer-phone">Customer phone</FieldLabel>
      <Input
        aria-activedescendant={listed ? optionId(active) : undefined}
        aria-controls={listed ? resultsId : undefined}
        aria-describedby={problem ? "customer-phone-error" : undefined}
        aria-expanded={editing ? undefined : listed}
        aria-invalid={problem ? true : undefined}
        autoComplete="off"
        autoFocus={!editing}
        id="customer-phone"
        inputMode="tel"
        maxLength={20}
        name="phone"
        onChange={form.onPhone}
        onKeyDown={form.onPhoneKeyDown}
        // A lookup field with a list under it is a combobox; an edit field is just text.
        role={editing ? undefined : "combobox"}
        touch
        value={draft.phone}
      />
      {problem && <FieldError id="customer-phone-error">{problem}</FieldError>}
    </Field>
  );
}

/** Name, type and, for a business, its name and TIN. An invoice makes the TIN required. */
export function CustomerFields({ form }: { form: CustomerForm }) {
  const { draft, invoice, tinShown, fixing } = form;
  return (
    <div className="grid gap-4">
      {fixing && (
        <p className="text-sm font-medium" role="status">
          {fixing.name} needs a TIN for the invoice
        </p>
      )}
      <TextField autoFocus={!fixing} field="name" form={form} label="Name" maxLength={200} />
      <div aria-label="Type" className="grid grid-cols-2 gap-2" role="group">
        {(["individual", "business"] as const).map((kind) => (
          <Button
            aria-pressed={draft.kind === kind}
            key={kind}
            onClick={() => form.change({ kind })}
            size="touch"
            type="button"
            variant={draft.kind === kind ? "default" : "outline"}
          >
            {kind === "individual" ? "Individual" : "Business"}
          </Button>
        ))}
      </div>
      {draft.kind === "business" && (
        <TextField field="businessName" form={form} label="Business name" maxLength={200} />
      )}
      {tinShown && (
        <TextField
          autoFocus={fixing !== null}
          field="tin"
          form={form}
          hint={invoice ? "Printed on the invoice." : "Optional. Printed on invoices."}
          label="TIN"
          maxLength={20}
        />
      )}
    </div>
  );
}
