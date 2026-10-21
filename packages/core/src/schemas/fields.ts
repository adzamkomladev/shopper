import * as v from "valibot";

export const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
export const name = text(200);
/** A Ghana mobile number as 0XXXXXXXXX; +233XXXXXXXXX and 233XXXXXXXXX are normalized to it. */
export const ghanaPhone = v.pipe(
  v.string(),
  v.regex(/^(?:0\d{9}|\+?233\d{9})$/),
  v.transform((phone) => phone.replace(/^\+?233/, "0")),
);
export const positiveInt = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(2_147_483_647),
);
// Strict ISO 8601 with Z or ±hh:mm, on a real calendar day (no silent 31 Feb -> 3 Mar roll-over).
export const timestamp = v.pipe(
  v.string(),
  v.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/),
  v.check((value) => {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number) as [
      number,
      number,
      number,
    ];
    return (
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    );
  }, "Invalid calendar date"),
  v.transform((value) => new Date(value)),
  v.check((date) => !Number.isNaN(date.getTime()), "Invalid timestamp"),
);
