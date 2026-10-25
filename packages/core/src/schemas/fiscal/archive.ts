import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

/** One store-hour of the fiscal archive; `hour` is the start of the UTC hour. */
export const fiscalArchiveParams = v.strictObject({
  orgId: uuidV7Schema,
  storeId: uuidV7Schema,
  hour: v.pipe(
    v.string(),
    v.isoTimestamp(),
    v.check((hour) => new Date(hour).getTime() % 3_600_000 === 0, "Expected the start of an hour"),
  ),
});
export type FiscalArchiveParams = v.InferOutput<typeof fiscalArchiveParams>;
