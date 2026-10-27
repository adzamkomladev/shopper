import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const day = v.pipe(v.string(), v.isoDate());
const userId = v.pipe(v.string(), v.uuid());

/** One store's trading day, in Accra (UTC all year). */
export const storeDayParams = v.strictObject({ orgId: uuidV7Schema, storeId: uuidV7Schema, day });

/** The queued email to one owner at closing: the registers that took sales and have not sent their Z yet. */
export const storeDayReminder = v.looseObject({
  type: v.literal("store-day.reminder"),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: v.strictObject({ storeId: uuidV7Schema, day, userId, registers: v.array(v.string()) }),
});

/** The queued email to one owner with the day's figures, read from `store_day.summary` when it is sent. */
export const storeDaySummary = v.looseObject({
  type: v.literal("store-day.summary"),
  v: v.literal(1),
  orgId: uuidV7Schema,
  payload: v.strictObject({ storeId: uuidV7Schema, day, userId }),
});
