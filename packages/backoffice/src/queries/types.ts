import * as v from "valibot";
import { roleListItem } from "@shopper/auth/schemas";
import { userListResponse } from "@shopper/auth/schemas";

export type RoleView = v.InferOutput<typeof roleListItem>;
export type RoleValues = { name: string; permissionCodes: string[] };

export type UserView = v.InferOutput<typeof userListResponse>[number];
/** The Edit access sheet: a role, and every branch or a chosen few. */
export type AccessValues = { roleId: string; everywhere: boolean; branchIds: string[] };
/** A member to deactivate or reactivate, and which. */
export type StatusChange = { member: UserView; action: "deactivate" | "reactivate" };
export type Revealed = { email: string; link: string };
export type InviteValues = { email: string; roleId: string; channel: string };
