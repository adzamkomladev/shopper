import * as v from "valibot";
import { invitationListItem } from "@shopper/auth/schemas";

export const invitationRow = v.object({
  ...v.omit(invitationListItem, ["setupLink"]).entries,
  deliveryStatus: v.optional(v.string()),
});
export type InvitationView = v.InferOutput<typeof invitationRow>;
export const issued = v.object({
  ...invitationListItem.entries,
  setupLink: v.optional(v.string()),
});

export const invitationList = v.array(invitationRow);

export const cancellationResponse = v.looseObject({});

export const roleResponse = v.looseObject({});
