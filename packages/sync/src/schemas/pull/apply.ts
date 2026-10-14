export const KNOWN_VERSION = 1;
import * as v from "valibot";

import { sequenceSchema } from "@shopper/ports";

export const page = v.object({
  changes: v.array(
    v.object({
      seq: sequenceSchema,
      entity: v.string(),
      entityId: v.string(),
      op: v.picklist(["upsert", "delete"]),
      v: v.pipe(v.number(), v.integer()),
      payload: v.unknown(),
    }),
  ),
  cursor: sequenceSchema,
  head: sequenceSchema,
  hasMore: v.boolean(),
});
export type Page = v.InferOutput<typeof page>;
