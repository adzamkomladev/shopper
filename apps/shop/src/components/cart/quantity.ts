/** How much one tap of the stepper adds: one item, or a quarter of a measured unit (0.25 kg, 0.25 l…). */
export const stepOf = (baseUnit: string) => (baseUnit === "each" ? 1_000 : 250);

/** A quantity as the shopper reads it: "3" for items, "1.25 kg" for measured goods. */
export function quantityLabel(quantityThousandths: number, baseUnit: string) {
  const amount = (quantityThousandths / 1_000).toLocaleString("en-GH", {
    maximumFractionDigits: 3,
  });
  return baseUnit === "each" ? amount : `${amount} ${baseUnit}`;
}
