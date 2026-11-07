import * as v from "valibot";

/** A watchdog day: the 23:59 UTC instant it fires at. */
export const watchParams = v.object({ at: v.pipe(v.string(), v.isoTimestamp()) });
/** A queued message; `messageBody` validated the envelope before it was launched. */
export const deliveryParams = v.unknown();
