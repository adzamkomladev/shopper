/** Quantities are integer thousandths. Text is parsed digit by digit, never through floats. */
export function parseQuantity(text: string, allowZero = false): number | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,3}))?$/.exec(text.trim());
  if (!match) return null;
  const thousandths = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  return thousandths > 0 || allowZero ? thousandths : null;
}

/** Thousandths as a decimal with the minus sign first: -1500 is "−1.5" (a true minus; pass "-" where text must be plain ASCII, as in an SMS). */
export function formatQuantity(thousandths: number, minus = "−"): string {
  const sign = thousandths < 0 ? minus : "";
  const magnitude = Math.abs(thousandths);
  const fraction = String(magnitude % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  const whole = Math.trunc(magnitude / 1000);
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}
