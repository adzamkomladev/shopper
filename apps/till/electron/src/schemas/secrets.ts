import * as v from "valibot";

export const registerSecrets = v.strictObject({
  v: v.literal(1),
  databaseKey: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
  deviceToken: v.pipe(v.string(), v.minLength(1)),
});
export type RegisterSecrets = v.InferOutput<typeof registerSecrets>;
