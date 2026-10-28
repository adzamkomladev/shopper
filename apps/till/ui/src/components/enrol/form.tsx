import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import * as v from "valibot";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import type { EnrolFailure, EnrolOutcome } from "../../enrol/types";
import { enrolForm, enrolQr, type EnrolErrors, type EnrolInput } from "../../schemas/enrol";
import { EnrolNotice } from "./notice";

type Values = Record<keyof EnrolInput, string>;

/**
 * Shop code, the one-time code and a name for this till; Enter submits. A scanner reading the portal's QR types
 * `shopper:enrol?shop=…&code=…` into whichever field has focus, which fills both codes, and its Enter submits.
 */
export function EnrolForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (input: EnrolInput) => Promise<EnrolOutcome>;
}) {
  const [values, setValues] = useState<Values>({ shopCode: "", code: "", name: "Till 1" });
  const [errors, setErrors] = useState<EnrolErrors>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<EnrolOutcome | null>(null);
  const refs = {
    shopCode: useRef<HTMLInputElement>(null),
    code: useRef<HTMLInputElement>(null),
    name: useRef<HTMLInputElement>(null),
  };
  const enrolled = outcome?.kind === "enrolled";

  function change(field: keyof Values) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const scanned = v.safeParse(enrolQr, event.target.value);
      if (scanned.success)
        return setValues((current) => ({
          ...current,
          shopCode: scanned.output.shop,
          code: scanned.output.code,
        }));
      setValues((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled || enrolled) return;
    const parsed = v.safeParse(enrolForm, values);
    if (!parsed.success) {
      const found = errorsOf(parsed.issues);
      setErrors(found);
      return refs[firstField(found)].current?.focus();
    }
    setErrors({});
    setBusy(true);
    const result = await onSubmit(parsed.output);
    setBusy(false);
    setOutcome(result);
    if (result.kind === "enrolled") return;
    if (result.code === "ENROL_REFUSED") setValues((current) => ({ ...current, code: "" }));
    refs[failedField(result.code)].current?.focus();
  }

  const field = (key: keyof Values) => ({
    "aria-describedby": `enrol-${key}-${errors[key] ? "error" : "help"}`,
    "aria-invalid": errors[key] ? true : undefined,
    id: `enrol-${key}`,
    name: key,
    onChange: change(key),
    readOnly: busy || enrolled,
    ref: refs[key],
    touch: true,
    value: values[key],
  });

  return (
    <form className="grid gap-6" noValidate onSubmit={(event) => void submit(event)}>
      <EnrolNotice outcome={outcome} />
      <Field data-invalid={errors.shopCode ? "true" : undefined}>
        <FieldLabel htmlFor="enrol-shopCode">Shop code</FieldLabel>
        <Input
          {...field("shopCode")}
          autoCapitalize="none"
          autoComplete="off"
          autoFocus
          placeholder="e.g. kumasi-mart"
          spellCheck={false}
        />
        {errors.shopCode ? (
          <FieldError id="enrol-shopCode-error">{errors.shopCode}</FieldError>
        ) : (
          <FieldDescription id="enrol-shopCode-help">
            Shown beside the code in the portal, under Devices. Or scan its QR code.
          </FieldDescription>
        )}
      </Field>
      <Field data-invalid={errors.code ? "true" : undefined}>
        <FieldLabel htmlFor="enrol-code">Enrolment code</FieldLabel>
        <Input
          {...field("code")}
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="6 digits"
        />
        {errors.code ? (
          <FieldError id="enrol-code-error">{errors.code}</FieldError>
        ) : (
          <FieldDescription id="enrol-code-help">
            A code works once, for 15 minutes.
          </FieldDescription>
        )}
      </Field>
      <Field data-invalid={errors.name ? "true" : undefined}>
        <FieldLabel htmlFor="enrol-name">Till name</FieldLabel>
        <Input {...field("name")} autoComplete="off" placeholder="e.g. Front till" />
        {errors.name ? (
          <FieldError id="enrol-name-error">{errors.name}</FieldError>
        ) : (
          <FieldDescription id="enrol-name-help">
            Printed on receipts and shown in the portal.
          </FieldDescription>
        )}
      </Field>
      <Button
        aria-busy={busy || enrolled}
        className="h-14 w-full rounded-xl text-base"
        disabled={disabled || busy || enrolled}
        type="submit"
      >
        {(busy || enrolled) && <LoaderCircle aria-hidden="true" className="animate-spin" />}
        {enrolled ? "Starting the till…" : busy ? "Setting up…" : "Set up this till"}
      </Button>
    </form>
  );
}

const order = ["shopCode", "code", "name"] as const;

function errorsOf(issues: v.BaseIssue<unknown>[]) {
  const found: EnrolErrors = {};
  for (const issue of issues) {
    const key = issue.path?.[0]?.key;
    if (order.includes(key as (typeof order)[number]) && !found[key as keyof EnrolErrors])
      found[key as keyof EnrolErrors] = issue.message;
  }
  return found;
}

const firstField = (errors: EnrolErrors) => order.find((key) => errors[key]) ?? "shopCode";

const failedField = (code: EnrolFailure) => (code === "SHOP_NOT_FOUND" ? "shopCode" : "code");
