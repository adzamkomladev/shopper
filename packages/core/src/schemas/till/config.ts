import * as v from "valibot";
import { receiptReference } from "../receipts/reference";
import { tillId } from "./fields";

export const tillReceiptCodes = v.strictObject({
  branchCode: v.pipe(v.string(), v.regex(/^BR[0-9]+$/)),
  deviceCode: v.pipe(v.string(), v.regex(/^T[0-9]+$/)),
});

export const tillConfiguration = v.object({
  orgId: tillId,
  deviceId: tillId,
  storeId: tillId,
  branchId: tillId,
  appVersion: v.pipe(v.string(), v.minLength(1)),
  receiptCodes: v.optional(tillReceiptCodes),
  receiptReference: v.optional(receiptReference),
});
