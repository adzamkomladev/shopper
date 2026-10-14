import type * as v from "valibot";
import type { permissionCode } from "@shopper/auth/schemas";

export type PermissionCode = v.InferOutput<typeof permissionCode>;
