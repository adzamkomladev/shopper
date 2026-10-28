import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { focusIfIdle } from "../../lib/focus";
import { STEPS } from "../../lib/setup/steps";
import type { Setup, SetupStep } from "../../schemas/setup";
import { DoneStep } from "./steps/done";
import { BranchStep, StoreStep } from "./steps/places";
import { ProductsStep } from "./steps/products";
import { TaxStep } from "./steps/tax";
import { TeamStep } from "./steps/team";
import { TillStep } from "./steps/till";

type Props = { step: SetupStep; progress: Setup; held: string[] };

/** One step: what it is for, its own form when the member may change it, and the way back and on. */
export function SetupStepPanel({ step, progress, held }: Props) {
  const index = STEPS.findIndex((each) => each.step === step);
  const [previous, next] = [STEPS[index - 1], STEPS[index + 1]];
  const done = progress.steps.some((each) => each.step === step && each.done);
  const canWrite = STEPS[index].needs.every((code) => held.includes(code));
  return (
    <section
      key={step}
      aria-labelledby="setup-step-title"
      className="flex min-w-0 flex-col gap-6 self-start rounded-lg border bg-card p-4 sm:p-6"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          {/* Focus lands on a new step's title, so a keyboard or screen reader user hears where they are. */}
          <h2
            id="setup-step-title"
            ref={focusIfIdle}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight outline-none"
          >
            {STEPS[index].title}
          </h2>
          {done && <Badge variant="secondary">Done</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{STEPS[index].description}</p>
      </header>
      {canWrite ? (
        <StepBody step={step} done={done} progress={progress} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {done ? "This step is done." : "This step is still to do."} Your role can't change it; the
          shop's owner can.
        </p>
      )}
      <footer className="flex justify-between gap-2 border-t pt-4">
        {previous ? (
          <Button variant="ghost" asChild>
            <Link to="/setup" search={{ step: previous.step }}>
              <ArrowLeftIcon aria-hidden />
              Back
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next && (
          <Button variant="outline" asChild>
            <Link to="/setup" search={{ step: next.step }}>
              {done ? "Next" : "Do this later"}
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        )}
      </footer>
    </section>
  );
}

function StepBody({ step, done, progress }: { step: SetupStep; done: boolean; progress: Setup }) {
  if (step === "store") return <StoreStep />;
  if (step === "branch") return <BranchStep />;
  if (step === "tax") return <TaxStep />;
  if (step === "products") return <ProductsStep done={done} />;
  if (step === "team") return <TeamStep />;
  if (step === "till") return <TillStep done={done} />;
  return <DoneStep progress={progress} />;
}
