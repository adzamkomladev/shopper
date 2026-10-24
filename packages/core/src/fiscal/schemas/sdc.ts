import * as v from "valibot";

// The SDC answers 200 with a signature, or 422 with a rejection; anything else is the SDC being unavailable.
export const sdcAcceptedSchema = v.object({
  status: v.literal("accepted"),
  sdcId: v.pipe(v.string(), v.minLength(1)),
  counter: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  signature: v.pipe(v.string(), v.minLength(1)),
  qr: v.pipe(v.string(), v.minLength(1)),
  signedAt: v.pipe(v.string(), v.isoTimestamp()),
});
export const sdcRejectedSchema = v.object({
  status: v.literal("rejected"),
  code: v.pipe(v.string(), v.minLength(1)),
  message: v.string(),
});
