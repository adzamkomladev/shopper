import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** The order queue's query: one stage (the new ones by default), optionally one branch or a search. */
export const orderQuery = v.object({
  stage: v.optional(v.picklist(["new", "preparing", "ready", "done"]), "new"),
  branchId: v.optional(uuidV7Schema),
  search: v.optional(v.string()),
});
