import * as v from "valibot";

export const number = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
export const receiptsSchema = v.strictObject({
  branchCode: v.pipe(v.string(), v.regex(/^BR[0-9]+$/)),
  deviceCode: v.pipe(v.string(), v.regex(/^T[0-9]+$/)),
  blocks: v.pipe(v.array(v.strictObject({ start: number, end: number })), v.maxLength(2)),
});

export const serverTimeSchema = v.pipe(v.string(), v.isoTimestamp());
