import type * as v from "valibot";
import type { tillConfiguration } from "../../schemas/till/config";
import type { TillSession } from "../../schemas/till/session";
import type { readShiftParts } from "./queries";

export type ShiftParts = Awaited<ReturnType<typeof readShiftParts>>;

/** A shift command's parsed config and session, with the corrected and the device time. */
export type Prepared = {
  config: v.InferOutput<typeof tillConfiguration>;
  session: TillSession;
  time: Date;
  deviceTime: Date;
};
