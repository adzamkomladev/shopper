import * as v from "valibot";
import { customerChanges } from "../customers/events";
import { draftEdit } from "./drafts";
import { tillId } from "./fields";
import { tillSession } from "./session";

const session = tillSession;
const scope = { orgId: tillId, deviceId: tillId, branchId: tillId };
const at = v.date();

/** `customerId: null` takes the customer off the basket. */
export const attachCustomerInput = v.strictObject({
  ...draftEdit,
  session,
  customerId: v.nullable(tillId),
});
export const updateTillCustomerInput = v.strictObject({
  scope: v.strictObject(scope),
  session,
  at,
  customerId: tillId,
  changes: customerChanges,
});
