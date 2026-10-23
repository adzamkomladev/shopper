import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup } from "@shopper/ui/components/field";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import type { KycSubject } from "../../../lib/kyc/types";
import { kycCustomersQuery } from "../../../queries/kyc/cases";
import { useKycActions } from "../../../queries/kyc/actions";
import { rolesQuery, roleLabel } from "../../../queries/roles";
import {
  startFormSchema,
  startRoleFormSchema,
  toRoleStartBody,
  toStartBody,
  type KycDetail,
} from "../../../schemas/kyc";
import { FormFooter } from "../../admin/form/sheet";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";
import { StartError, StepForm, useStepShortcut } from "./step";

type Props = { subject?: KycSubject; onOpened: (kase: KycDetail) => void };

const PHONE_HINT = "The code is texted to this number.";

/** Step 1: the phone to verify and what the check is for (a limit to ask for, or a role). */
export function PhoneStep({ subject, onOpened }: Props) {
  return subject?.kind === "member" ? (
    <RoleForm subject={subject} onOpened={onOpened} />
  ) : (
    <CreditForm subject={subject} onOpened={onOpened} />
  );
}

function CreditForm({ subject, onOpened }: { subject?: KycSubject; onOpened: Props["onOpened"] }) {
  const online = useOnline();
  const { open } = useKycActions();
  const customers = useQuery({ ...kycCustomersQuery(), enabled: !subject });
  const form = useForm({
    defaultValues: { customerId: subject?.id ?? "", phone: subject?.phone ?? "", limit: "" },
    validators: { onSubmit: startFormSchema },
    onSubmit: ({ value }) => open.mutate(toStartBody(value), { onSuccess: onOpened }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useStepShortcut(form, online && !open.isPending);
  const options = (customers.data?.items ?? []).map((customer) => ({
    value: customer.id,
    label: `${customer.name} · ${customer.phone}`,
  }));
  return (
    <StepForm shortcuts={shortcuts} form={form}>
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        {!subject && customers.isPending && <Skeleton className="h-9 w-full" />}
        {!subject && customers.isError && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>
              <p>{customers.error.message}</p>
              <Button className="mt-2" variant="outline" onClick={() => void customers.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!subject && customers.isSuccess && (
          <form.Field name="customerId">
            {(field) => (
              <SelectField
                field={field}
                label="Customer"
                placeholder="Choose a customer"
                options={options}
                autoFocus
                onChange={(id) => {
                  const chosen = customers.data.items.find((customer) => customer.id === id);
                  if (chosen) form.setFieldValue("phone", chosen.phone);
                }}
              />
            )}
          </form.Field>
        )}
        <form.Field name="phone">
          {(field) => (
            <TextField
              field={field}
              label="Phone number"
              description={PHONE_HINT}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              autoFocus={!!subject}
            />
          )}
        </form.Field>
        <form.Field name="limit">
          {(field) => (
            <TextField
              field={field}
              label="Credit limit requested (GH₵)"
              description="The most the customer may owe once the check is approved."
              inputMode="decimal"
              autoComplete="off"
            />
          )}
        </form.Field>
        {open.error && <StartError message={open.error.message} />}
      </FieldGroup>
      <FormFooter
        label="Send code"
        pending={open.isPending}
        pendingLabel="Sending…"
        online={online}
      />
    </StepForm>
  );
}

function RoleForm({
  subject,
  onOpened,
}: {
  subject: Extract<KycSubject, { kind: "member" }>;
  onOpened: Props["onOpened"];
}) {
  const online = useOnline();
  const { open } = useKycActions();
  const roles = useQuery(rolesQuery());
  const form = useForm({
    defaultValues: { roleId: "", phone: subject.phone ?? "" },
    validators: { onSubmit: startRoleFormSchema },
    onSubmit: ({ value }) =>
      open.mutate(toRoleStartBody(subject.id, value), { onSuccess: onOpened }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useStepShortcut(form, online && !open.isPending);
  const options = (roles.data ?? [])
    .filter((role) => !role.protectedOwner)
    .map((role) => ({ value: role.id, label: roleLabel(role) }));
  return (
    <StepForm shortcuts={shortcuts} form={form}>
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        <form.Field name="roleId">
          {(field) => (
            <SelectField
              field={field}
              label="Role"
              placeholder="Choose a role"
              options={options}
              autoFocus
            />
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <TextField
              field={field}
              label="Phone number"
              description={PHONE_HINT}
              type="tel"
              inputMode="tel"
              autoComplete="off"
            />
          )}
        </form.Field>
        {open.error && <StartError message={open.error.message} />}
      </FieldGroup>
      <FormFooter
        label="Send code"
        pending={open.isPending}
        pendingLabel="Sending…"
        online={online}
      />
    </StepForm>
  );
}
