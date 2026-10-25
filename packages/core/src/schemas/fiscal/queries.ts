import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { dateSchema } from "@shopper/tax";

/** The dashboard's segments: pending gathers documents waiting for the SDC and those being sent. */
export const fiscalSegments = ["all", "pending", "accepted", "rejected", "dead"] as const;
export const fiscalListQuery = v.object({
  status: v.optional(v.picklist(fiscalSegments), "all"),
  q: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(64))),
  branch: v.optional(uuidV7Schema),
});
export const fiscalArchiveQuery = v.object({ date: dateSchema });
export const fiscalDocId = v.pipe(v.string(), v.uuid());
