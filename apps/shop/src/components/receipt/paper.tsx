import { useState } from "react";
import { paper } from "@shopper/hardware";
import { ReceiptView } from "@shopper/hardware/receipt";
import type { ReceiptDocument } from "@shopper/core/schemas";

const PAPER = 80;

/** The receipt the till printed, drawn from its stored document and shrunk to the screen; nothing is re-rendered. */
export function ReceiptPaper({ receipt }: { receipt: ReceiptDocument }) {
  const dots = paper[PAPER].dots;
  const [scale, setScale] = useState(1);
  // A ref callback keeps the scale in step with the column's width, so no effect is needed.
  const measure = (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(() => setScale(Math.min(1, node.clientWidth / dots)));
    observer.observe(node);
    return () => observer.disconnect();
  };
  return (
    <div ref={measure} className="w-full">
      <div
        className="mx-auto w-fit overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5"
        style={{ zoom: scale }}
      >
        <ReceiptView paperMm={PAPER} receipt={receipt} reprint={false} />
      </div>
    </div>
  );
}
