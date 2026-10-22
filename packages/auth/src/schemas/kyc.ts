import * as v from "valibot";
import { ghanaPhone, positiveInt } from "@shopper/core/schemas";
import { kycIdTypes, kycStatuses } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { isValidId } from "../kyc/documents";

export const kycCaseId = v.pipe(
  uuidV7Schema,
  v.transform((id) => id.toLowerCase()),
);
const line = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));

export const kycIdTypeSchema = v.picklist(kycIdTypes);

/** A credit case names a customer and the limit asked for; a member case names the member, the role and a phone to verify. */
export const kycOpenInput = v.variant("purpose", [
  v.strictObject({
    purpose: v.literal("credit"),
    subject: v.strictObject({ customerId: kycCaseId }),
    requestedLimit: positiveInt,
    phone: v.optional(ghanaPhone),
  }),
  v.strictObject({
    purpose: v.literal("role"),
    subject: v.strictObject({ userId: kycCaseId }),
    requestedRoleId: kycCaseId,
    phone: ghanaPhone,
  }),
]);

export const kycVerifyInput = v.strictObject({ code: v.pipe(v.string(), v.regex(/^\d{6}$/)) });

export const kycIdInput = v.pipe(
  v.strictObject({
    idType: kycIdTypeSchema,
    idNumber: v.pipe(v.string(), v.maxLength(40)),
    fullName: line(200),
  }),
  v.forward(
    v.check((id) => isValidId(id.idType, id.idNumber), "Not a valid number for this ID type"),
    ["idNumber"],
  ),
);

export const kycDecisionInput = v.strictObject({
  approve: v.boolean(),
  limit: v.optional(positiveInt),
  roleId: v.optional(kycCaseId),
  idSighted: v.optional(v.boolean()),
  note: line(500),
});

export const kycSettingsInput = v.strictObject({
  idRequired: v.boolean(),
  idTypes: v.pipe(
    v.array(kycIdTypeSchema),
    v.minLength(1),
    v.check((types) => new Set(types).size === types.length, "Each ID type once"),
  ),
});

export const kycListQuery = v.object({ status: v.optional(v.picklist(kycStatuses)) });
