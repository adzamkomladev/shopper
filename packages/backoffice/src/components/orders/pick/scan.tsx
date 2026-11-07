import { useState } from "react";
import { ScanBarcodeIcon } from "lucide-react";
import { Input } from "@shopper/ui/components/input/control";
import type { OrderLine } from "../../../schemas/orders";

export const SCAN_ID = "pick-scan";

/**
 * A scanner types the code and presses Enter, so the field works with a keyboard wedge or by hand: a code on the
 * order ticks that item as found in full; one that is not on the order says so and changes nothing.
 */
export function ScanField({
  lines,
  onFound,
  disabled,
}: {
  lines: OrderLine[];
  onFound: (line: OrderLine) => void;
  disabled: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        const field = new FormData(event.currentTarget).get("code");
        const code = String(field ?? "").trim();
        if (!code) return;
        const line = lines.find((row) => row.barcodes.includes(code) || row.sku === code);
        setNote(line ? `${line.name} ticked off` : `${code} is not on this order`);
        if (line) onFound(line);
        event.currentTarget.reset();
      }}
    >
      <label htmlFor={SCAN_ID} className="flex items-center gap-1.5 text-sm font-medium">
        <ScanBarcodeIcon aria-hidden className="size-4" />
        Scan an item
      </label>
      <Input
        id={SCAN_ID}
        name="code"
        autoComplete="off"
        inputMode="numeric"
        disabled={disabled}
        aria-keyshortcuts="/"
        placeholder="Scan or type a barcode, then Enter"
        className="max-w-sm"
      />
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {note}
      </p>
    </form>
  );
}
