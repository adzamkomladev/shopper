import * as v from "valibot";

export const portalAuthResponse = v.nullable(
  v.object({ user: v.object({ id: v.string(), name: v.string(), email: v.string() }) }),
);
