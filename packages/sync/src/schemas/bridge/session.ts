import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";

const id = uuidV7Schema;

export const sessionRequests = [
  v.strictObject({
    id,
    type: v.literal("session.signIn"),
    email: v.pipe(v.string(), v.trim(), v.email(), v.maxLength(320)),
    password: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  }),
  v.strictObject({ id, type: v.literal("session.signOut") }),
] as const;
export const sessionRequestTypes = sessionRequests.map((schema) => schema.entries.type.literal);

/** The signed-in staff member; `offline` means the host answered without the server. */
export const sessionUser = v.strictObject({
  userId: v.string(),
  name: v.string(),
  permissions: v.array(v.string()),
  offline: v.boolean(),
});
