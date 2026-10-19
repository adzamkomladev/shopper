import { useState } from "react";
import { anyCount, countedTotal, parseCedis, parseCounts } from "../../shift/amount";
import type { CloseStep, CountText, ShiftActions } from "../../shift/types";

/**
 * The blind close up to the count: the notes and coins, then the card and MoMo terminal totals. Nothing here
 * knows what the register expects; the numbers go to the host in one `declare` and the answer comes back.
 */
export function useCloseForm(actions: ShiftActions) {
  const [step, setStep] = useState<CloseStep>("count");
  const [counts, setCounts] = useState<CountText>({});
  const [card, setCard] = useState("");
  const [momo, setMomo] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [cardTotal, momoTotal] = [parseCedis(card), parseCedis(momo)];
  /** Terminal totals are typed, and a terminal with no sales is a typed zero, so blanks do not pass. */
  const totalsBlock =
    cardTotal === null || momoTotal === null
      ? "Enter both terminal totals, even if they are 0"
      : null;
  /** An empty drawer is possible, but it is said by typing 0 in a box, never by leaving them all blank. */
  const countBlock =
    countedTotal(counts) > 0 || anyCount(counts)
      ? null
      : "Count at least one note or coin. If the drawer is empty, type 0 in a box.";
  const block = step === "count" ? countBlock : totalsBlock;

  async function declare() {
    if (pending || cardTotal === null || momoTotal === null) return;
    setPending(true);
    setProblem(null);
    const outcome = await actions.declare(parseCounts(counts), cardTotal, momoTotal);
    setPending(false);
    if (!outcome.ok) setProblem(outcome.message);
  }

  return {
    step,
    counts,
    card,
    momo,
    pending,
    problem,
    block,
    setCount: (face: string, text: string) => setCounts((now) => ({ ...now, [face]: text })),
    setCard,
    setMomo,
    next: () => countBlock === null && setStep("totals"),
    back: () => {
      setProblem(null);
      setStep("count");
    },
    declare,
  };
}
