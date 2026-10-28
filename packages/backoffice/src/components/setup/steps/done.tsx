import { Link, useNavigate } from "@tanstack/react-router";
import { CheckIcon, CircleIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { STEPS } from "../../../lib/setup/steps";
import { useSetupMove } from "../../../queries/setup";
import type { Setup } from "../../../schemas/setup";

/** Where each step stands, then Finish: the shop's front door stops leading here. */
export function DoneStep({ progress }: { progress: Setup }) {
  const online = useOnline();
  const navigate = useNavigate();
  const move = useSetupMove();
  const left = progress.steps.filter((each) => !each.done).length;
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2 text-sm">
        {progress.steps.map((each) => (
          <li key={each.step} className="flex items-center gap-2">
            {each.done ? (
              <CheckIcon aria-hidden className="size-4 text-primary" />
            ) : (
              <CircleIcon aria-hidden className="size-4 text-muted-foreground" />
            )}
            {STEPS.find((meta) => meta.step === each.step)?.title}
            <span className="text-muted-foreground">{each.done ? "Done" : "To do"}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        {left
          ? `${left} ${left === 1 ? "step is" : "steps are"} still to do. You can finish now and come back to them from their own screens.`
          : "Everything is set up. Ring up your first sale on the till."}
      </p>
      <p className="text-sm text-muted-foreground">
        To have mobile money settle to your own account,{" "}
        <Link to="/payments/verification" className="font-medium text-foreground underline">
          verify the business
        </Link>
        . Selling does not wait for it.
      </p>
      {progress.finished ? (
        <p className="text-sm font-medium">Setup is finished.</p>
      ) : (
        <Button
          className="self-start"
          disabled={!online || move.isPending}
          onClick={() =>
            move.mutate("finish", { onSuccess: () => void navigate({ to: "/products" }) })
          }
        >
          Finish setup
        </Button>
      )}
    </div>
  );
}
