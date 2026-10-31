import * as v from "valibot";
import { kybStatuses, updateChannels } from "@shopper/db-pg";

/** The queue's status filter; left out, the cases waiting for a reviewer. */
export const queueStatus = v.optional(v.picklist(kybStatuses), "in_review");

export const tenantChannel = v.strictObject({ channel: v.picklist(updateChannels) });
