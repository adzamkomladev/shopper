import * as v from "valibot";

import { tillReference } from "@shopper/core/schemas";
import { sequenceSchema, uuidV7Schema } from "@shopper/ports";

export const snapshotSchema = v.object({
  v: v.pipe(v.number(), v.integer()),
  orgId: uuidV7Schema,
  storeId: uuidV7Schema,
  cursor: sequenceSchema,
  reference: tillReference,
});
