/** Quantities are integer thousandths. Text is parsed digit by digit, never through floats. */
export function parseQuantity(text: string): number | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,3}))?$/.exec(text.trim());
  if (!match) return null;
  const thousandths = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  return thousandths > 0 ? thousandths : null;
}

export function formatQuantity(thousandths: number): string {
  const whole = Math.trunc(thousandths / 1000);
  const fraction = String(thousandths % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}
