import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { registerIdentity } from "./identity";

const id = uuidV7Schema;

/** A till not enrolled yet asks for one thing: to enrol with a shop code and a one-time code from the back office. */
export const enrolRequests = [
  v.strictObject({
    id,
    type: v.literal("device.enrol"),
    shopCode: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.minLength(1), v.maxLength(64)),
    code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
    name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  }),
] as const;
export const enrolRequestTypes = enrolRequests.map((schema) => schema.entries.type.literal);

export const enrolReplies = [
  /** The answer to hello or status from a till that has no identity yet. */
  v.strictObject({ id, type: v.literal("result"), kind: v.literal("unenrolled") }),
  v.strictObject({
    id,
    type: v.literal("result"),
    kind: v.literal("enrolled"),
    identity: registerIdentity,
  }),
] as const;

/** Why an enrolment was refused; the server does not tell a wrong code from an expired or used one. */
export const enrolErrors = ["SHOP_NOT_FOUND", "ENROL_REFUSED", "ENROL_LOCKED", "OFFLINE"] as const;
