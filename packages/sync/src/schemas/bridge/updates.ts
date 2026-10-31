import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { updateChannels } from "../connection";

/** What the Electron updater is doing; `off` when there is no updater (dev, tests, a host on its own). */
export const updateStates = [
  "off",
  "idle",
  "checking",
  "available",
  "downloading",
  "ready",
  "error",
] as const;

/** The updater's report from the Electron main process, folded into `hostStatus.update`. */
export const updaterState = v.strictObject({
  state: v.picklist(updateStates),
  /** The version on offer, once the feed names one. */
  version: v.nullable(v.pipe(v.string(), v.minLength(1))),
  percent: v.nullable(v.pipe(v.number(), v.minValue(0), v.maxValue(100))),
});
export const updaterMessage = v.strictObject({
  type: v.literal("update-state"),
  ...updaterState.entries,
});

export const updateStatus = v.strictObject({
  ...updaterState.entries,
  /** This build is below the server's minimum: no new shift opens until it updates. */
  required: v.boolean(),
  minVersion: v.nullable(v.string()),
  channel: v.picklist(updateChannels),
});

/** Restart into a downloaded update; refused while a shift is open. */
export const updateRequests = [
  v.strictObject({ id: uuidV7Schema, type: v.literal("register.update.install") }),
] as const;
export const updateRequestTypes = updateRequests.map((schema) => schema.entries.type.literal);

export type UpdateStatus = v.InferOutput<typeof updateStatus>;
