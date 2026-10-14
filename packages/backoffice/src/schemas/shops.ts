import * as v from "valibot";

export const shop = v.object({ id: v.string(), slug: v.string(), name: v.string() });
export const stored = v.object({ shops: v.array(shop), currentId: v.nullable(v.string()) });
export type Shop = v.InferOutput<typeof shop>;
