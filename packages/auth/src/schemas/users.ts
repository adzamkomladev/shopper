import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

export const assignRoleInput = v.strictObject({ userId: uuidV7Schema, roleId: uuidV7Schema });
export const registerUserInput = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  email: v.pipe(v.string(), v.trim(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
  roleId: uuidV7Schema,
});
