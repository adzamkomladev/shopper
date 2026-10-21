import { useState, type FormEvent } from "react";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { SaleOutcome } from "../../../sale/types";

/**
 * The submit of a shift dialog: Ctrl+Enter and Enter run `act` once, the dialog stays open on a refusal and
 * shows the host's words, and a success closes it. `ready` is false while the fields cannot be sent.
 */
export function useDialogSubmit(
  ready: boolean,
  act: () => Promise<SaleOutcome>,
  onDone: () => void,
) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function submit() {
    if (!ready || pending) return;
    setPending(true);
    setProblem(null);
    const outcome = await act();
    setPending(false);
    if (outcome.ok) onDone();
    else setProblem(outcome.message);
  }
  return {
    pending,
    problem,
    shortcuts: useShortcuts({ "Mod+Enter": () => void submit() }),
    onSubmit: (event: FormEvent) => {
      event.preventDefault();
      void submit();
    },
  };
}
