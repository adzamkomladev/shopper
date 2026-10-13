import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
export const acknowledgment = v.strictObject({
  requestId: uuidV7Schema,
  accepted: v.array(
    v.strictObject({
      localId: uuidV7Schema,
      sequence: v.pipe(
        v.string(),
        v.regex(/^[1-9][0-9]{0,18}$/),
        v.check((value) => BigInt(value) <= 9_223_372_036_854_775_807n),
      ),
    }),
  ),
  rejected: v.array(
    v.strictObject({
      localId: uuidV7Schema,
      code: v.pipe(v.string(), v.minLength(1)),
      message: v.pipe(v.string(), v.maxLength(500)),
    }),
  ),
});
export function readAcknowledgment(raw: unknown, requestId: string, submitted: string[]) {
  const parsed = v.parse(acknowledgment, raw);
  if (parsed.requestId !== requestId) throw new Error("Uncorrelated acknowledgment");
  const ids = [...parsed.accepted, ...parsed.rejected].map((entry) => entry.localId);
  if (new Set(ids).size !== ids.length || ids.some((id) => !submitted.includes(id)))
    throw new Error("Invalid acknowledgment membership");
  return parsed;
}
