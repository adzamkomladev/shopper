import * as v from "valibot";

export const session = v.nullable(
  v.object({ user: v.object({ id: v.string(), name: v.string(), email: v.string() }) }),
);
export const done = v.object({ success: v.boolean() });
