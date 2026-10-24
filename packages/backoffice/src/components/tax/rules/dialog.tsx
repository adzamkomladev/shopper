import { useForm } from "@tanstack/react-form";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveRule } from "../../../queries/tax/rules";
import {
  ruleFormSchema,
  ruleValues,
  toRuleBody,
  type TaxRuleView,
} from "../../../schemas/tax/rules";
import { AccountDialog, AccountForm } from "../../customers/account/shell";
import { TextField } from "../../fields/text";

type Props = {
  /** The scheduled rule being changed; none schedules a new one. */
  rule?: TaxRuleView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

/** Schedules a change of rates from a future date, or edits one that has not started. */
export function RuleDialog({ rule, ...dialog }: Props) {
  return (
    <AccountDialog
      {...dialog}
      title={rule ? "Edit scheduled rates" : "Schedule new rates"}
      description="Rates start on a future date. Sales already made keep the rates they were rung up with."
    >
      <RuleForm rule={rule} onSaved={() => dialog.onOpenChange(false)} />
    </AccountDialog>
  );
}

const RATES = [
  ["vat", "VAT (%)"],
  ["nhil", "NHIL (%)"],
  ["getfund", "GETFund levy (%)"],
  ["covid", "COVID-19 levy (%)"],
] as const;

function RuleForm({ rule, onSaved }: { rule?: TaxRuleView; onSaved: () => void }) {
  const save = useSaveRule(rule?.id, onSaved);
  const form = useForm({
    defaultValues: ruleValues(rule),
    validators: { onSubmit: ruleFormSchema },
    onSubmit: ({ value }) => save.mutate(toRuleBody(value)),
    onSubmitInvalid: focusFirstInvalid,
  });
  const clearError = () => save.isError && save.reset();
  return (
    <AccountForm
      onSubmit={() => void form.handleSubmit()}
      label={rule ? "Save rates" : "Schedule rates"}
      pending={save.isPending}
      error={save.error?.message}
    >
      <form.Field name="effectiveFrom">
        {(field) => (
          <TextField
            field={field}
            type="date"
            label="Starts on"
            description="Tomorrow at the earliest."
            autoFocus
            onChange={clearError}
          />
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-4">
        {RATES.map(([name, label]) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <TextField
                field={field}
                label={label}
                inputMode="decimal"
                autoComplete="off"
                onChange={clearError}
              />
            )}
          </form.Field>
        ))}
      </div>
      <form.Field name="source">
        {(field) => (
          <TextField
            field={field}
            label="Source"
            description="The GRA notice or budget statement the rates come from."
            autoComplete="off"
            onChange={clearError}
          />
        )}
      </form.Field>
    </AccountForm>
  );
}
