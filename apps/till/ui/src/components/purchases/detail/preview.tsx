import { useCallback, useState } from "react";
import { ReceiptView } from "@shopper/hardware/receipt";
import { paper } from "@shopper/hardware";
import type { PurchaseDetails } from "@shopper/sync/bridge";

/** The stored receipt JSON drawn at the paper width, shrunk to fit; the stored PDF is never rendered again. */
export function ReceiptPreview({
  receipt,
  paperMm,
  id,
}: {
  receipt: NonNullable<PurchaseDetails["receipt"]>;
  paperMm: 58 | 80;
  id: string;
}) {
  const dots = paper[paperMm].dots;
  const [scale, setScale] = useState(1);
  // A ref callback keeps the scale in step with the card's width, so no effect is needed.
  const measure = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const observer = new ResizeObserver(() => setScale(Math.min(1, node.clientWidth / dots)));
      observer.observe(node);
      return () => observer.disconnect();
    },
    [dots],
  );
  return (
    <section
      aria-label="Receipt preview"
      className="rounded-md border bg-muted/50 p-3 sm:p-4"
      id={id}
      ref={reveal}
    >
      <div ref={measure}>
        <div className="mx-auto w-fit border bg-white shadow-md" style={{ zoom: scale }}>
          <ReceiptView paperMm={paperMm} receipt={receipt} reprint={false} />
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {paperMm} mm paper · drawn from the stored receipt
      </p>
    </section>
  );
}

/** Runs once, when the preview opens (the function never changes), so a toggle at the foot of the card shows it. */
function reveal(node: HTMLElement | null) {
  node?.scrollIntoView({ block: "nearest" });
}
