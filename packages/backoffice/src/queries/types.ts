import * as v from "valibot";
import { roleListItem } from "@shopper/auth/schemas";
import { userListResponse } from "@shopper/auth/schemas";

export type RoleView = v.InferOutput<typeof roleListItem>;
export type RoleValues = { name: string; permissionCodes: string[] };

export type UserView = v.InferOutput<typeof userListResponse>[number];
export type Revealed = { email: string; link: string };
export type InviteValues = { email: string; roleId: string; channel: string };
