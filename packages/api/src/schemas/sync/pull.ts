import * as v from "valibot";
import { MAX_PULL_LIMIT } from "@shopper/core/changes";
import { sequenceSchema } from "@shopper/ports";

export const query = v.object({
  cursor: sequenceSchema,
  bootstrapped: v.optional(v.picklist(["true", "false"]), "false"),
  limit: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^\d+$/),
      v.transform(Number),
      v.integer(),
      v.minValue(1),
      v.maxValue(MAX_PULL_LIMIT),
    ),
    String(MAX_PULL_LIMIT),
  ),
});
