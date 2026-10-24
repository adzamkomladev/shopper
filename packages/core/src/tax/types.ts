import type { Money } from "@shopper/money";

/** One amount per part of a tax snapshot, summed over lines. */
export type TaxParts = Record<"base" | "vat" | "nhil" | "getfund" | "covid" | "gross", Money>;
