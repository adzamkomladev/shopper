import { useNavigate, useRouter } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { Kbd } from "@shopper/ui/components/kbd";
import { STEPS } from "../../lib/setup/steps";
import type { SetupStep } from "../../schemas/setup";

type Props = { current: SetupStep; done: Partial<Record<SetupStep, boolean>> };

/** The steps in order with where each stands; a phone scrolls them in a row, a laptop stacks them. */
export function SetupRail({ current, done }: Props) {
  const router = useRouter();
  const navigate = useNavigate();
  return (
    <nav
      aria-label="Setup steps"
      className="-mx-1 overflow-x-auto px-1 lg:mx-0 lg:overflow-visible lg:px-0"
    >
      <ol className="flex gap-2 lg:flex-col">
        {STEPS.map(({ step, title }, index) => {
          const finished = Boolean(done[step]);
          return (
            <li key={step} className="shrink-0">
              {/* A plain link: the router's Link marks itself the current page, and in a wizard it is the current step. */}
              <a
                href={router.buildLocation({ to: "/setup", search: { step } }).href}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                    return;
                  event.preventDefault();
                  void navigate({ to: "/setup", search: { step } });
                }}
                aria-current={step === current ? "step" : undefined}
                aria-describedby={`setup-${step}-state`}
                aria-keyshortcuts={`Alt+${index + 1}`}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=step]:bg-muted aria-[current=step]:text-foreground"
              >
                <span
                  aria-hidden
                  className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums ${finished ? "border-primary bg-primary text-primary-foreground" : ""}`}
                >
                  {finished ? <CheckIcon className="size-3.5" /> : index + 1}
                </span>
                {title}
                <Kbd aria-hidden className="ml-auto hidden lg:inline-flex">
                  Alt {index + 1}
                </Kbd>
              </a>
              {/* Outside the link, so it describes the step without becoming part of its name. */}
              <span id={`setup-${step}-state`} hidden>
                {step === "done" ? "" : finished ? "Done" : "To do"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
