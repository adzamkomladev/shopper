import { useState } from "react";
import { formatQuantity, parseQuantity } from "@shopper/utils";
import type { EligibilityView, PurchaseDetails } from "../../../sale/types";

type Entry = { text: string; capped: boolean };
const WHOLE = /^\d{0,6}$/;
const DECIMAL = /^\d{0,6}(?:[.,]\d{0,3})?$/;
const toQuantity = (text: string) => parseQuantity(text.replace(/[.,]$/, ""), true) ?? 0;

/**
 * What the cashier typed for each line, as text (so "0." can be typed on the way to "0.25") and as integer
 * thousandths, never above what is left to return.
 */
export function useReturnLines(purchase: PurchaseDetails, eligibility: EligibilityView) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const units = new Map(purchase.sale?.lines.map((line) => [line.id, line.baseUnit]));
  const limits = new Map(
    eligibility.lines.map((line) => [
      line.lineId,
      line.status === "eligible" ? line.remainingThousandths : 0,
    ]),
  );
  const quantities = Object.fromEntries(
    eligibility.lines.map((line) => [line.lineId, toQuantity(entries[line.lineId]?.text ?? "")]),
  );
  // A counted item moves by one, a weighed one by 100 g.
  const stepOf = (lineId: string) => (units.get(lineId) === "each" ? 1000 : 100);

  function set(lineId: string, text: string) {
    if (!(units.get(lineId) === "each" ? WHOLE : DECIMAL).test(text)) return;
    const limit = limits.get(lineId) ?? 0;
    const capped = toQuantity(text) > limit;
    setEntries((current) => ({
      ...current,
      [lineId]: { text: capped ? formatQuantity(limit) : text, capped },
    }));
  }
  function step(lineId: string, direction: 1 | -1) {
    const next = Math.min(
      limits.get(lineId) ?? 0,
      Math.max(0, (quantities[lineId] ?? 0) + direction * stepOf(lineId)),
    );
    setEntries((current) => ({
      ...current,
      [lineId]: { text: next === 0 ? "" : formatQuantity(next), capped: false },
    }));
  }
  return {
    quantities,
    limits,
    unitOf: (lineId: string) => units.get(lineId) ?? "each",
    textOf: (lineId: string) => entries[lineId]?.text ?? "",
    cappedAt: (lineId: string) => entries[lineId]?.capped ?? false,
    set,
    step,
  };
}
