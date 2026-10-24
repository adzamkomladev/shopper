import { useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useNow } from "@shopper/ui/hooks/use-now";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { ReadOnlyNote } from "../../../components/admin/states";
import { AccountDialog, AccountForm } from "../../../components/customers/account/shell";
import { Gate } from "../../../components/register/states";
import { RuleDialog } from "../../../components/tax/rules/dialog";
import { RulesTable, ruleRows } from "../../../components/tax/rules/table";
import type { RuleRow } from "../../../schemas/tax/rules";
import { TaxBodySkeleton } from "../../../components/tax/states";
import { TaxPage } from "../../../components/tax/tabs";
import { usePanel } from "../../../hooks/admin/panel";
import { shopToday } from "../../../lib/tax/dates";
import { usePermissions } from "../../../queries/session/permissions";
import { taxRulesQuery, useDeleteRule } from "../../../queries/tax/rules";

const NEW_ID = "tax-rule-new";

/** The dated tax rates: the one in force, those scheduled and those past. A super admin schedules changes. */
export function TaxRulesScreen() {
  const canWrite = !!usePermissions()?.includes("tax.write");
  const online = useOnline();
  const fallback = useRef<HTMLButtonElement>(null);
  const editor = usePanel<RuleRow>(fallback);
  const remover = usePanel<RuleRow>(fallback);
  const shortcuts = useShortcuts({ N: () => canWrite && online && editor.show(undefined, NEW_ID) });
  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col">
      <TaxPage
        active="rules"
        action={
          canWrite && (
            <Button
              id={NEW_ID}
              ref={fallback}
              disabled={!online}
              onClick={() => editor.show(undefined, NEW_ID)}
            >
              <PlusIcon aria-hidden />
              Schedule new rates
              <Kbd aria-hidden>N</Kbd>
            </Button>
          )
        }
      >
        <Gate
          need="tax.read"
          what="tax rates"
          fallback={<TaxBodySkeleton label="Loading tax rates" />}
        >
          <RulesBody
            onEdit={canWrite && online ? (rule, trigger) => editor.show(rule, trigger) : undefined}
            onRemove={
              canWrite && online ? (rule, trigger) => remover.show(rule, trigger) : undefined
            }
          />
          {!canWrite && <ReadOnlyNote>Only a super admin can schedule new rates.</ReadOnlyNote>}
        </Gate>
      </TaxPage>
      {editor.open && (
        <RuleDialog
          key={editor.value?.id ?? "new"}
          rule={editor.value}
          open={editor.open}
          onOpenChange={editor.setOpen}
          restoreFocus={editor.restoreFocus}
        />
      )}
      {remover.value && (
        <RemoveDialog
          rule={remover.value}
          open={remover.open}
          onOpenChange={remover.setOpen}
          restoreFocus={remover.restoreFocus}
        />
      )}
    </div>
  );
}

function RulesBody(props: Pick<React.ComponentProps<typeof RulesTable>, "onEdit" | "onRemove">) {
  const { data } = useSuspenseQuery(taxRulesQuery());
  // A page left open past midnight moves a scheduled rule into force without a reload.
  const now = useNow(60_000);
  return <RulesTable rows={ruleRows(data.rules, shopToday(new Date(now)))} {...props} />;
}

function RemoveDialog({
  rule,
  ...dialog
}: {
  rule: RuleRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
}) {
  const remove = useDeleteRule(() => dialog.onOpenChange(false));
  return (
    <AccountDialog
      {...dialog}
      title="Remove scheduled rates?"
      description={`The rates from ${rule.effectiveFrom} will not start. The rates in force stay.`}
    >
      <AccountForm
        onSubmit={() => remove.mutate(rule.id)}
        label="Remove rates"
        pending={remove.isPending}
        error={remove.error?.message}
      >
        {null}
      </AccountForm>
    </AccountDialog>
  );
}
