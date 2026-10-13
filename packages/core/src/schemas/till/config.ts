import * as v from "valibot";
import { tillId } from "./fields";

export const tillConfiguration = v.object({
  orgId: tillId,
  deviceId: tillId,
  storeId: tillId,
  branchId: tillId,
  appVersion: v.pipe(v.string(), v.minLength(1)),
});
