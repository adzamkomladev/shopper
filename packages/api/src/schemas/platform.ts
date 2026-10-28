import * as v from "valibot";
import { kybStatuses } from "@shopper/db-pg";

/** The queue's status filter; left out, the cases waiting for a reviewer. */
export const queueStatus = v.optional(v.picklist(kybStatuses), "in_review");
