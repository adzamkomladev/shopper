import * as v from "valibot";
import { tillSession } from "@shopper/core/schemas";

/** `POST /cashiers/login` answer. */
export const cashierLogin = v.object({
  id: tillSession.entries.id,
  token: v.pipe(v.string(), v.minLength(1)),
  issuedAt: v.pipe(v.string(), v.isoTimestamp()),
  expiresAt: v.pipe(v.string(), v.isoTimestamp()),
  permissions: v.array(v.string()),
  roleName: v.string(),
  userId: tillSession.entries.userId,
  userName: v.string(),
});
