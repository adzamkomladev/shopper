import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { emailSchema, linkTokenSchema, passwordSchema, personNameSchema } from "./onboarding";
export const invitationIssueSchema = v.strictObject({
  email: emailSchema,
  roleId: uuidV7Schema,
  channel: v.picklist(["email", "local"]),
});
export const invitationAcceptSchema = v.strictObject({
  token: linkTokenSchema,
  name: v.optional(personNameSchema),
  password: v.optional(passwordSchema),
});
export const invitationTokenSchema = v.strictObject({ token: linkTokenSchema });
export const invitationListItem = v.object({
  id: uuidV7Schema,
  email: v.string(),
  roleId: v.nullable(uuidV7Schema),
  channel: v.picklist(["email", "local"]),
  status: v.string(),
  expiresAt: v.string(),
  createdAt: v.string(),
  consumedAt: v.nullable(v.string()),
  setupLink: v.optional(v.string()),
  deliveryStatus: v.optional(v.picklist(["pending", "sent", "failed"])),
});
export const invitationListResponse = v.array(invitationListItem);
export const invitationPreviewResponse = v.strictObject({
  id: uuidV7Schema,
  orgId: uuidV7Schema,
  shopCode: v.string(),
  shopName: v.string(),
  email: v.string(),
  roleId: uuidV7Schema,
  roleName: v.string(),
  channel: v.picklist(["email", "local"]),
  expiresAt: v.string(),
  existingAccount: v.boolean(),
});
export const invitationAcceptResponse = v.strictObject({
  orgId: uuidV7Schema,
  shopCode: v.string(),
  email: v.string(),
  userId: uuidV7Schema,
  roleId: uuidV7Schema,
});
