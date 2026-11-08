import { useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { FieldGroup } from "@shopper/ui/components/field";
import { AreaField } from "../fields/area";
import { TextField } from "../fields/text";
import { focusFirstInvalid } from "../../lib/focus";
import { SHOP_CODE_HELP, suggestShopCode } from "../../schemas/auth/onboarding";
import {
  codeStep,
  licenceStep,
  ownerStep,
  shopStep,
  type InstallValues,
} from "../../schemas/install/form";
import { RequestCode } from "../billing/licence";
import { InstallStep } from "./step";

type Step<Keys extends keyof InstallValues> = {
  values: Partial<InstallValues>;
  onNext: (values: Pick<InstallValues, Keys>) => void;
  onBack?: () => void;
  action?: string;
  pending?: boolean;
  error?: string;
};

export function CodeStep({ values, onNext, error, action = "Continue" }: Step<"code">) {
  const form = useForm({
    defaultValues: { code: values.code ?? "" },
    validators: { onSubmit: codeStep },
    onSubmit: ({ value }) => onNext(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  return (
    <InstallStep onSubmit={() => void form.handleSubmit()} action={action} error={error}>
      <form.Field name="code">
        {(field) => (
          <TextField
            field={field}
            label="Setup code"
            description="Printed at the end of the installer, on the box's screen. Case does not matter."
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono tracking-widest uppercase"
          />
        )}
      </form.Field>
    </InstallStep>
  );
}

export function ShopStep({
  values,
  onNext,
  onBack,
  action = "Continue",
  error,
}: Step<"shopName" | "shopCode" | "storeName">) {
  // The code follows the shop's name until the person types their own.
  const codeEdited = useRef(false);
  const form = useForm({
    defaultValues: {
      shopName: values.shopName ?? "",
      shopCode: values.shopCode ?? "",
      storeName: values.storeName ?? "",
    },
    validators: { onSubmit: shopStep },
    onSubmit: ({ value }) => onNext(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  return (
    <InstallStep
      onSubmit={() => void form.handleSubmit()}
      onBack={onBack}
      action={action}
      error={error}
    >
      <FieldGroup className="gap-4">
        <form.Field name="shopName">
          {(field) => (
            <TextField
              field={field}
              label="Shop name"
              autoFocus
              autoComplete="organization"
              onChange={(event) => {
                if (!codeEdited.current)
                  form.setFieldValue("shopCode", suggestShopCode(event.target.value));
              }}
            />
          )}
        </form.Field>
        <form.Field name="shopCode">
          {(field) => (
            <TextField
              field={field}
              label="Shop code"
              description={SHOP_CODE_HELP}
              autoCapitalize="none"
              spellCheck={false}
              onChange={() => {
                codeEdited.current = true;
              }}
            />
          )}
        </form.Field>
        <form.Field name="storeName">
          {(field) => (
            <TextField
              field={field}
              label="First store"
              description="The store this box serves. Add its branches and tills next."
            />
          )}
        </form.Field>
      </FieldGroup>
    </InstallStep>
  );
}

export function OwnerStep({
  values,
  onNext,
  onBack,
  action = "Continue",
  pending,
  error,
}: Step<"name" | "email" | "password">) {
  const form = useForm({
    defaultValues: {
      name: values.name ?? "",
      email: values.email ?? "",
      password: values.password ?? "",
    },
    validators: { onSubmit: ownerStep },
    onSubmit: ({ value }) => onNext(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  return (
    <InstallStep
      onSubmit={() => void form.handleSubmit()}
      onBack={onBack}
      action={action}
      pending={pending}
      error={error}
    >
      <FieldGroup className="gap-4">
        <form.Field name="name">
          {(field) => (
            <TextField field={field} label="Owner's name" autoFocus autoComplete="name" />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => <TextField field={field} label="Email" type="email" autoComplete="email" />}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <TextField
              field={field}
              label="Password"
              type="password"
              autoComplete="new-password"
              description="At least 12 characters. The owner signs in with this."
            />
          )}
        </form.Field>
      </FieldGroup>
    </InstallStep>
  );
}

export function LicenceStep({
  values,
  onNext,
  onBack,
  request,
  pending,
  error,
}: Step<"licence"> & { request?: string }) {
  const form = useForm({
    defaultValues: { licence: values.licence ?? "" },
    validators: { onSubmit: licenceStep },
    onSubmit: ({ value }) => onNext(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  return (
    <InstallStep
      onSubmit={() => void form.handleSubmit()}
      onBack={onBack}
      action="Install"
      pending={pending}
      error={error}
    >
      <FieldGroup className="gap-4">
        {request && <RequestCode code={request} />}
        <form.Field name="licence">
          {(field) => (
            <AreaField
              field={field}
              label="Licence"
              description="Send the request code to Shopper support. Paste the licence.json they return."
              autoFocus
              rows={6}
              spellCheck={false}
              className="font-mono text-xs"
            />
          )}
        </form.Field>
      </FieldGroup>
    </InstallStep>
  );
}
