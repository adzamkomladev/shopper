import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { emailSchema, passwordSchema, personNameSchema, shopCodeSchema } from "./onboarding";

/** A box's first boot: the installer's setup code, the shop and its first store, the owner, and the licence. */
export const installSchema = v.strictObject({
  code: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
  shop: v.strictObject({ name: personNameSchema, code: shopCodeSchema }),
  store: v.strictObject({ name: personNameSchema }),
  owner: v.strictObject({ name: personNameSchema, email: emailSchema, password: passwordSchema }),
  // Checked against the box's issuer and machine before anything is created; absent only where none is enforced.
  licence: v.optional(v.unknown()),
});
export const installStateResponse = v.strictObject({
  needsInstall: v.boolean(),
  licence: v.strictObject({ enforced: v.boolean(), request: v.optional(v.string()) }),
  // Installed with `--import`: the shop the archive holds, which this box takes over instead of creating one.
  import: v.optional(v.strictObject({ shop: v.string() })),
});
/** A box installed with `--import` takes over its shop: the setup code and the licence the cloud issued for the move. */
export const installImportSchema = v.strictObject({
  code: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
  licence: v.unknown(),
});
export const installResultResponse = v.strictObject({
  orgId: uuidV7Schema,
  shopCode: v.string(),
  email: v.string(),
});
