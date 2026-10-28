import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const day = v.pipe(v.string(), v.isoDate());

const director = v.strictObject({
  name: text(120),
  ghanaCard: v.pipe(v.string(), v.trim(), v.toUpperCase(), v.maxLength(20)),
  cardExpiresOn: day,
  cardAssetId: uuidV7Schema,
});
const document = v.strictObject({
  kind: v.picklist(["registration_certificate", "tin_certificate"]),
  assetId: uuidV7Schema,
  expiresOn: v.nullable(day),
});

/** A whole case: what submitting needs. The formats themselves are the checks' job, so a typo still submits. */
export const kybSubmission = v.object({
  businessName: text(200),
  registrationNumber: text(40),
  tin: v.pipe(v.string(), v.trim(), v.toUpperCase(), v.maxLength(20)),
  settlementBank: text(20),
  settlementAccount: v.pipe(text(30), v.regex(/^\d+$/, "Account numbers are digits only")),
  directors: v.pipe(
    v.array(director),
    v.minLength(1, "Add at least one director"),
    v.maxLength(10),
  ),
  documents: v.pipe(
    v.array(document),
    v.minLength(1, "Upload the business documents"),
    v.maxLength(10),
  ),
});

/** A draft saves any part of a case; each part has the submission's shape. */
export const kybDraft = v.partial(v.strictObject(kybSubmission.entries));

/** The decision a Shopper reviewer makes on one submission. */
export const kybDecision = v.strictObject({
  /** A Shopper staff member: a user of the platform org, never of the shop. */
  reviewerId: uuidV7Schema,
  version: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  decision: v.picklist(["approved", "rejected"]),
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(1000))),
});

export const kybFlowParams = v.object({ orgId: uuidV7Schema });

export const kybNotices = [
  "submitted",
  "checks_failed",
  "approved",
  "rejected",
  "renew",
  "expired",
] as const;

/** After a case changes: wakes or starts the shop's KYB workflow and tells the owners what they must know. */
export const kybNoticeMessage = v.object({
  type: v.literal("kyb.notice"),
  payload: v.object({ notice: v.picklist(kybNotices) }),
});
