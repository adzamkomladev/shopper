import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { FieldGroup } from "@shopper/ui/components/field";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../../components/admin/form-sheet";
import { SelectField } from "../../components/fields/select";
import { TextField } from "../../components/fields/text";
import { focusFirstInvalid } from "../../lib/focus";
import { branchFormSchema, emptyBranch } from "../../schemas/management";
import { useSaveBranch } from "./queries";

type Props = {
  branch?: { id: string; name: string; storeId: string };
  stores: { id: string; name: string }[];
  onSaved: () => void;
};

export function BranchForm({ branch, stores, onSaved }: Props) {
  const online = useOnline();
  const save = useSaveBranch(branch, onSaved);
  const form = useForm({
    defaultValues: branch
      ? { name: branch.name, storeId: branch.storeId }
      : emptyBranch(stores.length === 1 ? stores[0]!.id : ""),
    validators: { onSubmit: branchFormSchema },
    onSubmit: ({ value }) => save.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) void form.handleSubmit();
    },
  });
  const clearError = () => {
    if (save.isError) save.reset();
  };
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="flex-1 overflow-y-auto px-4">
        <form.Field name="name">
          {(field) => (
            <TextField
              field={field}
              label="Name"
              autoFocus
              autoComplete="off"
              onChange={clearError}
            />
          )}
        </form.Field>
        <form.Field name="storeId">
          {(field) => (
            <SelectField
              field={field}
              label="Store"
              placeholder="Choose a store"
              options={stores.map((store) => ({ value: store.id, label: store.name }))}
            />
          )}
        </form.Field>
        {save.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{save.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter label="Save branch" pending={save.isPending} online={online} />
    </form>
  );
}
