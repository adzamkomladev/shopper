export type GoldenProduct = "standard" | "zero" | "exempt" | "weighed" | "labelled" | "up" | "down";
export type GoldenSale = {
  name: string;
  lines: { product: GoldenProduct; quantity?: number; code?: string; discount?: number }[];
  tenders: { kind: "cash" | "momo" | "card"; amount: number }[];
  held?: boolean;
  voided?: boolean;
  rounding?: "none" | "10p";
  /** The till's tax settings; the golden till is inclusive and VAT-registered from the statutory start. */
  settings?: { priceMode?: "inclusive" | "exclusive"; vatRegisteredFrom?: string | null };
};
