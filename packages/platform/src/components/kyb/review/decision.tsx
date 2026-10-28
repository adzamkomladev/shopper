import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { AreaField, focusFirstInvalid, MOD_KEY, shiftTime } from "@shopper/backoffice/kit";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { Kbd, KbdGroup } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { STATUS_LABELS } from "../../../lib/kyb/status";
import { useDecide } from "../../../queries/platform";
import { approvalNote, decisionNote } from "../../../schemas/platform";
import type { KybCase } from "../../../schemas/types";
import { Section } from "./details";

type Choice = "approved" | "rejected";

/** A approves, R rejects, Mod+Enter confirms. A case not in review shows where it stands instead. */
export function DecisionPanel({ kase }: { kase: KybCase }) {
  const [choice, setChoice] = useState<Choice>();
  const decide = useDecide(kase.orgId);
  const reviewing = kase.status === "in_review";
  const choose = (next: Choice) => {
    if (!reviewing || decide.isPending) return;
    decide.reset();
    setChoice(next);
  };
  const shortcuts = useShortcuts({ A: () => choose("approved"), R: () => choose("rejected") });
  return (
    <div ref={shortcuts}>
      <Section label="Decision">
        {reviewing ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={choice === "approved" ? "default" : "outline"}
                aria-pressed={choice === "approved"}
                onClick={() => choose("approved")}
              >
                Approve
                <Kbd aria-hidden>A</Kbd>
              </Button>
              <Button
                variant={choice === "rejected" ? "destructive" : "outline"}
                aria-pressed={choice === "rejected"}
                onClick={() => choose("rejected")}
              >
                Reject
                <Kbd aria-hidden>R</Kbd>
              </Button>
            </div>
            {choice && <DecisionForm key={choice} kase={kase} choice={choice} decide={decide} />}
          </>
        ) : (
          <Outcome kase={kase} />
        )}
      </Section>
    </div>
  );
}

type FormProps = { kase: KybCase; choice: Choice; decide: ReturnType<typeof useDecide> };

function DecisionForm({ kase, choice, decide }: FormProps) {
  const online = useOnline();
  const navigate = useNavigate();
  const approve = choice === "approved";
  const form = useForm({
    defaultValues: { note: "" },
    validators: { onSubmit: approve ? approvalNote : decisionNote },
    onSubmit: ({ value }) =>
      decide.mutate(
        { version: kase.version, decision: choice, note: value.note.trim() || undefined },
        {
          onSuccess: (decided) => {
            toast.success(approve ? "Business approved" : "Submission rejected");
            void navigate({
              to: "/kyb",
              search: { status: decided.status === "approved" ? "approved" : "rejected" },
            });
          },
        },
      ),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !decide.isPending) void form.handleSubmit();
    },
  });
  return (
    <form
      ref={shortcuts}
      noValidate
      aria-label={approve ? "Approve this business" : "Reject this submission"}
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="note">
        {(field) => (
          <AreaField
            field={field}
            label={approve ? "Note (optional)" : "What the shop must fix"}
            description={approve ? "Kept with the decision." : "The owner is emailed this reason."}
            autoFocus
            onChange={() => decide.isError && decide.reset()}
          />
        )}
      </form.Field>
      {decide.error && (
        <Alert variant="destructive">
          <AlertDescription>{decide.error.message}</AlertDescription>
        </Alert>
      )}
      {!online && (
        <p role="status" className="text-sm text-muted-foreground">
          You're offline. Reconnect to decide.
        </p>
      )}
      <Button
        type="submit"
        variant={approve ? "default" : "destructive"}
        className="self-start"
        disabled={!online || decide.isPending}
      >
        {decide.isPending && <Loader2Icon className="animate-spin" aria-hidden />}
        {approve ? "Approve business" : "Reject submission"}
        <KbdGroup aria-hidden>
          <Kbd>{MOD_KEY}</Kbd>
          <Kbd>Enter</Kbd>
        </KbdGroup>
      </Button>
    </form>
  );
}

const WAITING: Partial<Record<KybCase["status"], string>> = {
  draft: "The shop has not submitted yet.",
  submitted: "The automated checks are running. Refresh in a moment.",
  checks_failed: "The submission failed its checks and is back with the shop to fix.",
};

function Outcome({ kase }: { kase: KybCase }) {
  if (!kase.decidedAt)
    return <p className="text-sm text-muted-foreground">{WAITING[kase.status]}</p>;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">
        {STATUS_LABELS[kase.status]} {shiftTime(kase.decidedAt)}
      </p>
      {kase.decisionNote && <p className="text-muted-foreground">{kase.decisionNote}</p>}
      <p className="text-muted-foreground">
        {kase.payouts
          ? "Payouts go to the shop's Paystack subaccount."
          : kase.status === "approved"
            ? "The Paystack subaccount is being opened."
            : "No Paystack subaccount."}
      </p>
    </div>
  );
}
