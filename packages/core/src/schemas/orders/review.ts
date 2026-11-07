import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** A shopper's review of their order: one to five stars and, if they like, a few words. */
export const reviewInput = v.object({
  id: uuidV7Schema,
  rating: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)),
  comment: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.maxLength(500),
      v.transform((text) => text || null),
    ),
    "",
  ),
});

/** A moderator's call on a flagged review. */
export const reviewDecision = v.picklist(["approve", "reject"]);
