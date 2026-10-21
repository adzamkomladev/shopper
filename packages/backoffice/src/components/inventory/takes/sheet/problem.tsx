import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import { takeProblem } from "../../../../lib/inventory/takes";
import type { TakeLine } from "../../../../queries/inventory/types";

type Props = {
  error: Error | null;
  lines: TakeLine[];
  onShowUncounted: () => void;
  onRecount: (productId: string) => void;
  onRefresh: () => void;
};

type Words = { title: string; detail: string; step?: { label: string; run: () => void } };

/** What stopped a count, a post or a cancel, and the one step that gets past it. */
export function SheetProblem({ error, lines, onShowUncounted, onRecount, onRefresh }: Props) {
  const problem = takeProblem(error);
  if (!problem) return null;
  const stale =
    problem.kind === "superseded"
      ? lines.find((line) => line.productId === problem.productId)
      : undefined;
  const words: Words = {
    not_counted: {
      title: "Count every product before posting",
      detail: `${problem.message}. Show what is left, count it, then post again.`,
      step: { label: "Show uncounted", run: onShowUncounted },
    },
    closed: {
      title: "This stock take is closed",
      detail: `${problem.message}. Nothing more can be counted or posted on it.`,
      step: { label: "Refresh the take", run: onRefresh },
    },
    superseded: {
      title: `A till counted ${stale?.name ?? "a product"} after you did`,
      detail:
        "Posting your older count would undo the newer one. Recount that line, then post again.",
      step: stale && { label: `Recount ${stale.name}`, run: () => onRecount(stale.productId) },
    },
    open: { title: "Couldn't complete that", detail: problem.message },
    other: { title: "Couldn't complete that", detail: problem.message },
  }[problem.kind];
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertTitle>{words.title}</AlertTitle>
      <AlertDescription>
        <p>{words.detail}</p>
        {words.step && (
          <Button variant="outline" size="sm" className="mt-2" onClick={words.step.run}>
            {words.step.label}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
