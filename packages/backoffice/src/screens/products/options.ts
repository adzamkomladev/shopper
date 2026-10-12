import type { ProductSummary } from "./queries";

export const UNITS = [
  { value: "each", label: "Each" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "l", label: "Litre (l)" },
  { value: "ml", label: "Millilitre (ml)" },
] as const satisfies readonly { value: ProductSummary["baseUnit"]; label: string }[];

export const TAX_CLASSES = [
  { value: "standard", label: "Standard" },
  { value: "zero-rated", label: "Zero-rated" },
  { value: "exempt", label: "Exempt" },
] as const satisfies readonly { value: ProductSummary["taxClass"]; label: string }[];
