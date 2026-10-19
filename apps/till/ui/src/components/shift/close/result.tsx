import { Loader2, LockKeyhole } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import { VarianceTable } from "@shopper/backoffice/shifts";
import { Button } from "@shopper/ui/components/button";
import { FieldError } from "@shopper/ui/components/field";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { takeFocus } from "../../../hooks/focus";
import { useApprovalForm } from "../../../hooks/approval/form";
import type { ShiftActions, ShiftSnapshot } from "../../../shift/types";
import { ApprovalFields } from "../../approval/fields";
import { Stepper } from "./stepper";

const card = "rounded-lg border bg-card shadow-sm";

/**
 * Step three: what the count found against what the register expected, and the close. The count is final, so
 * this is all that is left; a manager's PIN is asked for only when the host needs one.
 */
export function CloseResult({
  snapshot,
  actions,
  active,
}: {
  snapshot: ShiftSnapshot;
  actions: ShiftActions;
  active: boolean;
}) {
  const { judgement, approvalRequired, approvers } = snapshot;
  const manager = useApprovalForm(approvers, approvalRequired);
  const close = () => void manager.submit(actions.close);
  const register = useShortcuts(active ? { "Mod+Enter": close, "Alt+Z": close } : {});
  const block = approvalRequired && !manager.ready ? "Choose a manager and enter their PIN" : null;
  return (
    <section
      aria-label="Close shift"
      className="grid gap-4 outline-none"
      ref={(node) => {
        const cleanup = register(node);
        takeFocus(node, active);
        return cleanup;
      }}
      tabIndex={-1}
    >
      <div className={`${card} flex flex-wrap items-center justify-between gap-4 p-4`}>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Close shift</h2>
          <p className="text-sm text-muted-foreground">
            {approvalRequired
              ? judgement?.threshold != null
                ? `A manager must approve a variance above ${formatGHS(money(judgement.threshold))}. The count is final.`
                : "A manager must approve the close. The count is final."
              : "The drawer is counted. Close the shift to finish."}
          </p>
        </div>
        <Stepper current={2} />
      </div>
      {judgement?.variances && (
        <div className={`${card} overflow-hidden`}>
          <VarianceTable label="Variance by tender" variances={judgement.variances} />
        </div>
      )}
      <form
        className={`${card} grid gap-4 p-4`}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          close();
        }}
      >
        {approvalRequired && (
          <ApprovalFields
            approvers={approvers}
            form={manager}
            onRetry={() => actions.loadApprovers()}
            permission="shift.approve"
          />
        )}
        {manager.problem && <FieldError role="alert">{manager.problem}</FieldError>}
        <Button
          aria-describedby={block ? "close-approval-block" : undefined}
          aria-keyshortcuts="Alt+Z"
          className="w-full sm:w-fit sm:justify-self-end"
          disabled={!manager.ready || manager.pending}
          size="touch"
          type="submit"
        >
          {manager.pending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <LockKeyhole aria-hidden="true" />
          )}
          Close shift <Kbd className="max-sm:hidden">Alt+Z</Kbd>
        </Button>
        {block && (
          <p className="text-sm text-muted-foreground sm:text-right" id="close-approval-block">
            {block}
          </p>
        )}
      </form>
    </section>
  );
}
