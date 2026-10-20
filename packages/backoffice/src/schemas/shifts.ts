import * as v from "valibot";
import { zReport } from "@shopper/core/schemas";

// Rows and the Z share the server's schemas, so the screen and the API change together.
export const shiftRow = v.object({
  id: v.string(),
  deviceId: v.string(),
  deviceName: v.string(),
  branchId: v.string(),
  branchName: v.string(),
  openedAt: v.string(),
  closedAt: v.string(),
  closedBy: v.string(),
  closedByName: v.string(),
  approverId: v.nullable(v.string()),
  approverName: v.nullable(v.string()),
  expectedCash: v.number(),
  declaredCash: v.number(),
  /** Σ of the tenders that came up short, in minor units: 0 or less. */
  short: v.number(),
  /** Σ of the tenders that came up over: 0 or more. Kept apart from `short` so offsetting tenders are not "balanced". */
  over: v.number(),
});
export type ShiftView = v.InferOutput<typeof shiftRow>;

export const shiftList = v.object({ shifts: v.array(shiftRow) });

/** One shift with its stored Z and the names of the members the Z mentions. */
export const shiftDetail = v.object({
  ...shiftRow.entries,
  report: zReport,
  names: v.record(v.string(), v.string()),
});
