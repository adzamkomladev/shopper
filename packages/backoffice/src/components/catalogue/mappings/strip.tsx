import {
  DIGITS,
  digitsText,
  rangeOf,
  roleOfDigit,
  valueName,
} from "../../../lib/catalogue/mappings/digits";
import type { DigitRange, Kind } from "../../../lib/catalogue/mappings/types";

type Layout = {
  kind: Kind;
  productStart: string;
  productLength: string;
  valueStart: string;
  valueLength: string;
};

// White on the success fill and muted text on the muted fill both miss AA for small digits, so the
// value digits sit on a green tint with a green edge, and muted cells use slate-600.
const CELL = {
  prefix: "bg-muted text-kbd-foreground",
  product: "bg-primary text-primary-foreground",
  value: "border border-success bg-success/15 text-foreground",
  conflict: "bg-destructive text-white",
  check: "bg-muted text-kbd-foreground",
  free: "border border-dashed text-muted-foreground",
} as const;

/** The 13 digits of a label coloured by what each one carries; an overlap shows in red as you type. */
export function LayoutStrip({ layout }: { layout: Layout }) {
  const product = rangeOf(Number(layout.productStart), Number(layout.productLength));
  const value = rangeOf(Number(layout.valueStart), Number(layout.valueLength));
  const name = valueName(layout.kind);
  const parts: [string, DigitRange | undefined][] = [
    ["prefix", { first: 1, last: 2 }],
    ["product code", product],
    [name, value],
    ["check digit", { first: 13, last: 13 }],
  ];
  const described = parts.filter((part): part is [string, DigitRange] => !!part[1]);
  const label = `Barcode layout: ${described.map(([what, range]) => `${digitsText(range)} ${what}`).join(", ")}.`;
  return (
    <div className="flex flex-col gap-3">
      <div role="img" aria-label={label} className="grid grid-cols-13 gap-1">
        {DIGITS.map((digit) => (
          <span
            key={digit}
            aria-hidden
            className={`flex aspect-square items-center justify-center rounded-sm text-xs font-medium tabular-nums ${CELL[roleOfDigit(digit, product, value)]}`}
          >
            {digit}
          </span>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {described.map(([what, range]) => (
          <li key={what}>
            {what.charAt(0).toUpperCase() + what.slice(1)}, {digitsText(range)}
          </li>
        ))}
      </ul>
    </div>
  );
}
