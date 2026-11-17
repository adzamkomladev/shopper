import * as v from "valibot";

/** A dry run is named by its archive's id. */
export const dryRunId = v.pipe(v.string(), v.uuid());
