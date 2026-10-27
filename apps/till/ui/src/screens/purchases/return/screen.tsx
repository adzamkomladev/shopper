import type { KeyboardEvent } from "react";
import { useReturnForm } from "../../../hooks/purchases/return/form";
import { approvalReason } from "../../../purchases/policy";
import type {
  ApproverState,
  EligibilityView,
  PurchaseActions,
  PurchaseDetails,
  ReturnState,
} from "../../../sale/types";
import { ReturnFrame } from "../../../components/purchases/return/frame";
import { ReturnLinesCard, ReturnReason } from "../../../components/purchases/return/lines";
import { ReturnSkeleton, ReturnStop } from "../../../components/purchases/return/states";
import { ReturnSummary } from "../../../components/purchases/return/summary";
import { ReturnTender } from "../../../components/purchases/return/tender";

/** The step that replaces the purchase detail: what to return, why, how to pay it back, and who approves. */
export function ReturnScreen({
  purchase,
  state,
  approvers,
  actions,
  active,
}: {
  purchase: PurchaseDetails;
  state: ReturnState;
  approvers: ApproverState;
  actions: PurchaseActions;
  active: boolean;
}) {
  if (state.status === "ready" && state.eligibility.refundable)
    return (
      <ReturnWorkspace
        actions={actions}
        active={active}
        approvers={approvers}
        eligibility={state.eligibility}
        purchase={purchase}
      />
    );
  return (
    <ReturnFrame
      active={active}
      focusBack={state.status !== "loading"}
      onBack={actions.endReturn}
      purchase={purchase}
      shortcuts={{ Escape: actions.endReturn }}
    >
      {state.status === "loading" ? (
        <ReturnSkeleton />
      ) : (
        <ReturnStop onRetry={() => actions.startReturn(purchase)} state={state} />
      )}
    </ReturnFrame>
  );
}

function ReturnWorkspace({
  purchase,
  eligibility,
  approvers,
  actions,
  active,
}: {
  purchase: PurchaseDetails;
  eligibility: EligibilityView;
  approvers: ApproverState;
  actions: PurchaseActions;
  active: boolean;
}) {
  const form = useReturnForm(purchase, eligibility, approvers, actions);
  return (
    <ReturnFrame
      active={active}
      focusBack={false}
      onBack={actions.endReturn}
      purchase={purchase}
      shortcuts={shortcuts(form, actions.endReturn)}
    >
      <div className="grid min-h-0 shrink-0 grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="grid min-w-0 content-start gap-4 xl:col-span-8">
          <ReturnLinesCard eligibility={eligibility} lines={form.lines} purchase={purchase} />
          <ReturnReason onChange={form.setReason} value={form.reason} />
        </div>
        <form
          className="grid content-start gap-4 xl:col-span-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.submit();
          }}
        >
          <ReturnTender
            kind={form.kind}
            onKind={form.setKind}
            onReference={form.setReference}
            reference={form.reference}
          />
          <ReturnSummary
            approvalNote={approvalReason(eligibility)}
            approvers={approvers}
            form={form}
            onRetryApprovers={() => actions.loadApprovers("refund.approve")}
          />
        </form>
      </div>
    </ReturnFrame>
  );
}

/**
 * Every action has a key: Alt+1, 2 and 3 pick the method, Alt+P and Alt+R the manager here or remotely, Alt+A asks
 * remotely, Ctrl+Enter refunds, Escape goes back.
 */
function shortcuts(form: ReturnType<typeof useReturnForm>, back: () => void) {
  return {
    "Alt+1": () => form.setKind("cash"),
    "Alt+2": () => form.setKind("card"),
    "Alt+3": () => form.setKind("momo"),
    "Alt+P": () => form.remote.setMode("pin"),
    "Alt+R": () => form.remote.setMode("remote"),
    "Alt+A": () => form.remote.mode === "remote" && form.remote.ask(),
    "Mod+Enter": () => void form.submit(),
    Escape: (event: KeyboardEvent) => {
      // Escape that closes the open manager list belongs to the list.
      if (event.target instanceof Element && event.target.closest("[role=listbox]")) return;
      back();
    },
  };
}
