import type * as v from "valibot";
import type { permissionCode } from "@shopper/auth/schemas";

export type PermissionCode = v.InferOutput<typeof permissionCode>;

/** A page or link that any one of several permissions opens. */
export type PermissionNeed = PermissionCode | readonly PermissionCode[];
