import * as v from "valibot";

/** The online store's settings: on a box, the Online Orders switch and how its last publish went. */
export const onlineSettingsView = v.object({
  box: v.boolean(),
  onlineOrders: v.boolean(),
  publishedAt: v.nullable(v.string()),
  error: v.nullable(v.string()),
});
export type OnlineSettingsView = v.InferOutput<typeof onlineSettingsView>;
