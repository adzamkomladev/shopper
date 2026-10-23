import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CircleCheckIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { SheetClose, SheetFooter } from "@shopper/ui/components/sheet";
import type { KycDetail } from "../../schemas/kyc";
import { focusOnMount } from "../../lib/focus";
import { FormSheet } from "../admin/form/sheet";
import { CodeStep } from "./start/code";
import { IdStep } from "./start/id";
import type { KycSubject } from "../../lib/kyc/types";
import { PhoneStep } from "./start/phone";

export type { KycSubject } from "../../lib/kyc/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Moves focus to whatever opened the sheet, which is gone or elsewhere once it closes. */
  restoreFocus: () => void;
  /** Who the check is for. Leave it out to choose a customer in the sheet. */
  subject?: KycSubject;
};

type Stage =
  | { step: "phone" }
  | { step: "code"; kase: KycDetail }
  | { step: "id"; kase: KycDetail }
  | { step: "done"; kase: KycDetail };

const STEP_NUMBER = { phone: 1, code: 2, id: 3 } as const;

/**
 * Starts an identity check in three steps: the phone and what is asked for, the code texted to that phone, then
 * the ID (which can be skipped when the shop does not require one). Used from the Identity checks page, and meant
 * for a customer's page (a credit check) and the Users page (a role check).
 */
export function KycStartSheet({ open, onOpenChange, restoreFocus, subject }: Props) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Start an identity check"
      description="Verify the phone with a code, then add an ID if the person has one."
      restoreFocus={restoreFocus}
    >
      <StartFlow subject={subject} onClose={() => onOpenChange(false)} />
    </FormSheet>
  );
}

function StartFlow({ subject, onClose }: { subject?: KycSubject; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>({ step: "phone" });
  return (
    <>
      {stage.step !== "done" && (
        <p className="px-4 text-xs text-muted-foreground">Step {STEP_NUMBER[stage.step]} of 3</p>
      )}
      {stage.step === "phone" && (
        <PhoneStep subject={subject} onOpened={(kase) => setStage({ step: "code", kase })} />
      )}
      {stage.step === "code" && (
        <CodeStep kase={stage.kase} onVerified={(kase) => setStage({ step: "id", kase })} />
      )}
      {stage.step === "id" && (
        <IdStep kase={stage.kase} onDone={(kase) => setStage({ step: "done", kase })} />
      )}
      {stage.step === "done" && <Done kase={stage.kase} onClose={onClose} />}
    </>
  );
}

function Done({ kase, onClose }: { kase: KycDetail; onClose: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col items-start gap-3 px-4">
        <CircleCheckIcon className="size-8 text-success" aria-hidden />
        <h2
          tabIndex={-1}
          ref={focusOnMount}
          className="text-lg font-medium tracking-tight outline-none"
        >
          Sent for approval
        </h2>
        <p className="text-sm text-muted-foreground">
          {kase.phone} is verified{kase.idType ? " and the ID is on file" : ", with no ID"}. Someone
          who can approve identity checks will see it under Awaiting approval.
        </p>
      </div>
      <SheetFooter className="flex-col-reverse sm:flex-row sm:justify-end">
        <SheetClose asChild>
          <Button type="button" variant="outline">
            Done
          </Button>
        </SheetClose>
        <Button asChild>
          <Link to="/kyc/$caseId" params={{ caseId: kase.id }} onClick={onClose}>
            Open the check
          </Link>
        </Button>
      </SheetFooter>
    </>
  );
}
