import * as v from "valibot";

/** The online store's settings: on a box, the Online Orders switch and how its last publish went. */
export const onlineSettingsView = v.object({
  box: v.boolean(),
  onlineOrders: v.boolean(),
  /** Units of every product kept back from the online store. */
  buffer: v.number(),
  publishedAt: v.nullable(v.string()),
  error: v.nullable(v.string()),
});
export type OnlineSettingsView = v.InferOutput<typeof onlineSettingsView>;

/** The units kept back from the online store, as typed: a whole number from 0 to 10 000. */
export const bufferFormSchema = v.object({
  buffer: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d{1,5}$/, "Enter a whole number, like 2, or 0 to keep nothing back"),
    v.check((text) => Number(text) <= 10_000, "Keep back at most 10 000"),
  ),
});
