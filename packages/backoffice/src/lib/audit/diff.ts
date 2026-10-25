/**
 * Field-level diff of an entry's before and after: the top-level fields of either side, in first-seen order, with
 * nested values shown as JSON. A side that is not an object (or is absent) shows as a single "value" field.
 */
export function auditDiff(before: unknown, after: unknown) {
  const fields = (side: unknown) =>
    side === null || side === undefined
      ? {}
      : typeof side === "object" && !Array.isArray(side)
        ? (side as Record<string, unknown>)
        : { value: side };
  const left = fields(before);
  const right = fields(after);
  const text = (value: unknown) =>
    value === undefined ? null : typeof value === "string" ? value : JSON.stringify(value);
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].map((field) => {
    const row = { field, before: text(left[field]), after: text(right[field]) };
    return { ...row, changed: row.before !== row.after };
  });
}

/** `price.set` → "Price set"; `till.draft.price` → "Till draft price". */
export const commandLabel = (command: string) => {
  const words = command.replaceAll(".", " ").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A shop time to the second, "2026-10-24 14:05:09" (shop time is UTC). */
export const auditTime = (iso: string) => iso.slice(0, 19).replace("T", " ");
