import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const day = v.pipe(v.string(), v.isoDate());

/** One org's Paystack payouts settled on one Accra date. */
export const settlementParams = v.strictObject({ orgId: uuidV7Schema, day });

export const settlementRefresh = v.strictObject({ day });

export const reconciliationQuery = v.object({
  day,
  branchId: v.optional(v.pipe(v.string(), v.uuid())),
});
