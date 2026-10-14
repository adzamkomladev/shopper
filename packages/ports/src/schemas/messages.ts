import * as v from "valibot";
import { jsonSchema, sequenceSchema, uuidV7Schema } from "./primitives";
export const envelopeSchema = v.object({
  id: uuidV7Schema,
  orgId: uuidV7Schema,
  v: v.pipe(v.number(), v.integer(), v.minValue(1)),
  sequence: sequenceSchema,
  type: v.pipe(v.string(), v.minLength(1)),
  payload: jsonSchema,
});
