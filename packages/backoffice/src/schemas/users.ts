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

/** Status and branch writes answer with the changed record; screens refetch, so any object does. */
export const changeResponse = v.looseObject({});

export const grantableBranches = v.object({
  branches: v.array(v.object({ id: v.string(), name: v.string() })),
});

/** The Users screen's tab: active members unless `status=deactivated`. */
export const usersSearch = v.object({
  status: v.fallback(v.optional(v.picklist(["deactivated"])), undefined),
});
export type UsersSearch = v.InferOutput<typeof usersSearch>;
