import { useForm } from "@tanstack/react-form";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveAccount } from "../../../queries/ledger/books";
import { accountForm } from "../../../schemas/ledger/forms";
import type { ChartRow } from "../../../schemas/ledger/views";
import { AccountDialog, AccountForm } from "../../customers/account/shell";
import { CheckField } from "../../fields/check";
import { SelectField } from "../../fields/select";
import { TextField } from "../../fields/text";
import { TYPE_LABELS } from "../labels";

type Props = {
  /** The account being changed; none adds a custom one. */
  account?: ChartRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

const TYPES = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

/** Adds a custom account, or renames one; a custom account can also be archived (system ones never). */
export function LedgerAccountDialog({ account, ...dialog }: Props) {
  return (
    <AccountDialog
      {...dialog}
      title={account ? `Edit ${account.code} ${account.name}` : "Add an account"}
      description={
        account
          ? "Posted lines keep this account; a new name shows everywhere."
          : "Custom accounts take manual entries. Sales and stock keep posting to the system accounts."
      }
    >
      <AccountFields account={account} onSaved={() => dialog.onOpenChange(false)} />
    </AccountDialog>
  );
}

function AccountFields({ account, onSaved }: { account?: ChartRow; onSaved: () => void }) {
  const save = useSaveAccount(account?.id, onSaved);
  const form = useForm({
    defaultValues: {
      code: account?.code ?? "",
      name: account?.name ?? "",
      type: account?.type ?? "",
      archived: account?.archived ?? false,
    },
    validators: { onSubmit: account ? undefined : accountForm },
    onSubmit: ({ value }) =>
      save.mutate(
        account
          ? { name: value.name.trim(), ...(account.systemKey ? {} : { archived: value.archived }) }
          : { code: value.code, name: value.name.trim(), type: value.type },
      ),
    onSubmitInvalid: focusFirstInvalid,
  });
  const clearError = () => save.isError && save.reset();
  return (
    <AccountForm
      onSubmit={() => void form.handleSubmit()}
      label={account ? "Save account" : "Add account"}
      pending={save.isPending}
      error={save.error?.message}
    >
      {!account && (
        <form.Field name="code">
          {(field) => (
            <TextField
              field={field}
              label="Code"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              onChange={clearError}
            />
          )}
        </form.Field>
      )}
      <form.Field name="name">
        {(field) => (
          <TextField
            field={field}
            label="Name"
            autoComplete="off"
            autoFocus={!!account}
            onChange={clearError}
          />
        )}
      </form.Field>
      {!account && (
        <form.Field name="type">
          {(field) => (
            <SelectField field={field} label="Type" options={TYPES} placeholder="Pick a type" />
          )}
        </form.Field>
      )}
      {account && !account.systemKey && (
        <form.Field name="archived">
          {(field) => (
            <CheckField
              field={field}
              label="Archived"
              description="An archived account takes no new entries."
            />
          )}
        </form.Field>
      )}
    </AccountForm>
  );
}
