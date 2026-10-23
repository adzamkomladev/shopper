import { useForm } from "@tanstack/react-form";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { MOD_KEY } from "../../../lib/mod/key";
import {
  approveSchema,
  limitText,
  rejectSchema,
  toDecisionBody,
  type DecisionValues,
  type KycDetail,
} from "../../../schemas/kyc";
import { AreaField } from "../../fields/area";
import { CheckField } from "../../fields/check";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";
import { StartError } from "../start/step";

type Props = {
  kase: KycDetail;
  approve: boolean;
  roles: { value: string; label: string }[];
  pending: boolean;
  error?: string;
  onSubmit: (body: ReturnType<typeof toDecisionBody>) => void;
  onClearError: () => void;
};

/** The fields of one decision: an approval asks for the limit (or role) and the sighted tick; a rejection for the reason. */
export function DecisionForm({
  kase,
  approve,
  roles,
  pending,
  error,
  onSubmit,
  onClearError,
}: Props) {
  const online = useOnline();
  const credit = kase.purpose === "credit";
  const hasId = kase.idType !== null;
  const defaults: DecisionValues = {
    sighted: false,
    limit: limitText(kase.requestedLimit),
    roleId: kase.requestedRoleId ?? "",
    note: "",
  };
  const form = useForm({
    defaultValues: defaults,
    validators: { onSubmit: approve ? approveSchema(credit, hasId) : rejectSchema },
    onSubmit: ({ value }) => onSubmit(toDecisionBody(approve, credit, value, hasId)),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !pending) void form.handleSubmit();
    },
  });
  return (
    <form
      ref={shortcuts}
      noValidate
      aria-label={approve ? "Approve this check" : "Reject this check"}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        {approve && credit && (
          <form.Field name="limit">
            {(field) => (
              <TextField
                field={field}
                label="Approved limit (GH₵)"
                description="The most this customer may owe. It can be lower than what was asked."
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                onChange={onClearError}
              />
            )}
          </form.Field>
        )}
        {approve && !credit && roles.length > 0 && (
          <form.Field name="roleId">
            {(field) => <SelectField field={field} label="Role" options={roles} autoFocus />}
          </form.Field>
        )}
        {approve && hasId && (
          <form.Field name="sighted">
            {(field) => (
              <CheckField
                field={field}
                label="I sighted the ID document"
                description="Tick this once you have seen the document and its details match the ones above."
                onChange={onClearError}
              />
            )}
          </form.Field>
        )}
        <form.Field name="note">
          {(field) => (
            <AreaField
              field={field}
              label={approve ? "Note (optional)" : "Reason for rejecting"}
              description={approve ? undefined : "The reason is kept with the check."}
              autoFocus={!approve}
              onChange={onClearError}
            />
          )}
        </form.Field>
        {error && <StartError message={error} />}
      </FieldGroup>
      <Button
        type="submit"
        className="self-start"
        variant={approve ? "default" : "destructive"}
        disabled={!online || pending}
      >
        {pending ? (
          "Saving…"
        ) : (
          <>
            {approve ? "Confirm approval" : "Confirm rejection"}
            <Kbd aria-hidden>{MOD_KEY} ↵</Kbd>
          </>
        )}
      </Button>
    </form>
  );
}
