import { enrolFormSchema } from "../../../schemas/devices/enrol/form";
import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { FieldGroup } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { SheetClose, SheetFooter } from "@shopper/ui/components/sheet";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { FormFooter } from "../../admin/form/sheet";
import { SelectField } from "../../fields/select";
import { focusFirstInvalid, focusOnMount } from "../../../lib/focus";
import { formatDateTime } from "../../../lib/catalogue/detail/prices/groups";
import { useIssueEnrolment } from "../../../queries/devices";

type Props = { branches: { id: string; name: string }[] };

/** Two steps in one sheet: choose the branch, then read the code out to the till. */
export function EnrolForm({ branches }: Props) {
  const online = useOnline();
  const issue = useIssueEnrolment();
  const form = useForm({
    defaultValues: { branchId: "" },
    validators: { onSubmit: enrolFormSchema },
    onSubmit: ({ value }) => issue.mutate(value.branchId),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (!issue.data && online && !issue.isPending) void form.handleSubmit();
    },
  });
  if (issue.data) {
    const [first, second] = [issue.data.code.slice(0, 3), issue.data.code.slice(3)];
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 px-4">
          <p className="text-sm text-muted-foreground">
            Enter this code on the till. It works once, and expires{" "}
            {formatDateTime(issue.data.expiresAt)}.
          </p>
          <output
            aria-label="Enrolment code"
            className="rounded-lg border bg-muted/50 py-6 text-center text-4xl font-semibold tracking-widest tabular-nums"
          >
            {first} {second}
          </output>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button ref={focusOnMount}>
              Done
              <Kbd aria-hidden>↵</Kbd>
            </Button>
          </SheetClose>
        </SheetFooter>
      </div>
    );
  }
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
        <form.Field name="branchId">
          {(field) => (
            <SelectField
              field={field}
              label="Branch"
              placeholder="Choose a branch"
              autoFocus
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
          )}
        </form.Field>
        {issue.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>{issue.error.message}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <FormFooter
        label="Create code"
        pendingLabel="Creating…"
        pending={issue.isPending}
        online={online}
      />
    </form>
  );
}
