import { useForm } from "@tanstack/react-form";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { useKycActions } from "../../../queries/kyc/actions";
import { otpFormSchema, type KycDetail } from "../../../schemas/kyc";
import { FormFooter } from "../../admin/form/sheet";
import { TextField } from "../../fields/text";
import { StartError, StepForm, useStepShortcut } from "./step";

type Props = { kase: KycDetail; onVerified: (kase: KycDetail) => void };

/** Step 2: the six digits texted to the phone. Alt+R sends another code. */
export function CodeStep({ kase, onVerified }: Props) {
  const online = useOnline();
  const { verify, resend } = useKycActions();
  const form = useForm({
    defaultValues: { code: "" },
    validators: { onSubmit: otpFormSchema },
    onSubmit: ({ value }) =>
      verify.mutate({ id: kase.id, body: { code: value.code.trim() } }, { onSuccess: onVerified }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const sendAnother = () => {
    if (online && !resend.isPending) resend.mutate({ id: kase.id });
  };
  const shortcuts = useStepShortcut(form, online && !verify.isPending, { "Alt+R": sendAnother });
  const error = verify.error ?? resend.error;
  return (
    <StepForm shortcuts={shortcuts} form={form}>
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        <p className="text-sm">Enter the code sent to {kase.phone}</p>
        <form.Field name="code">
          {(field) => (
            <TextField
              field={field}
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              onChange={() => {
                if (verify.isError) verify.reset();
              }}
            />
          )}
        </form.Field>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={!online || resend.isPending}
          onClick={sendAnother}
        >
          Send a new code
          <Kbd aria-hidden>Alt R</Kbd>
        </Button>
        {error && <StartError message={error.message} />}
      </FieldGroup>
      <FormFooter
        label="Verify"
        pending={verify.isPending}
        pendingLabel="Checking…"
        online={online}
      />
    </StepForm>
  );
}
