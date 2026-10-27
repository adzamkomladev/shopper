import { CheckCircle2, CircleAlert, LoaderCircle, Send } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { RemoteState } from "../../sale/remote/types";

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

/**
 * Asking a manager who is not at the register: they answer from the back office within 10 minutes. `approved` is
 * false when the answer was for a different refund than the one on screen now.
 */
export function RemoteApproval({
  state,
  approved,
  canAsk,
  onAsk,
}: {
  state: RemoteState;
  approved: boolean;
  /** The refund has items and a reason, so there is something to approve. */
  canAsk: boolean;
  onAsk: () => void;
}) {
  if (state.status === "asking" || state.status === "pending")
    return (
      <p className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm" role="status">
        <LoaderCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin" />
        <span>
          {state.status === "asking"
            ? "Sending the request…"
            : `Waiting for a manager to answer in the back office. The request expires at ${time(state.expiresAt)}.`}
        </span>
      </p>
    );
  if (state.status === "approved" && approved)
    return (
      <p
        className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm font-medium"
        role="status"
      >
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />A manager
        approved this refund.
      </p>
    );
  const note =
    state.status === "approved"
      ? "The refund changed after the manager approved it. Ask again."
      : state.status === "declined"
        ? `A manager declined this refund${state.message ? `: ${state.message}` : "."}`
        : state.status === "expired"
          ? "No manager answered within 10 minutes."
          : state.status === "offline" || state.status === "refused"
            ? state.message
            : "A manager can approve this refund from the back office.";
  return (
    <div className="grid justify-items-start gap-2 text-sm" role="status">
      <p className="flex items-start gap-2 text-muted-foreground">
        {state.status !== "idle" && (
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        )}
        {note}
      </p>
      <Button disabled={!canAsk} onClick={onAsk} size="touch" type="button" variant="outline">
        <Send aria-hidden="true" />
        {state.status === "idle" ? "Ask a manager" : "Ask again"}
        <Kbd className="max-sm:hidden">Alt+A</Kbd>
      </Button>
      {!canAsk && <p className="text-xs text-muted-foreground">Choose items and a reason first.</p>}
    </div>
  );
}
