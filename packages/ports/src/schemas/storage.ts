import * as v from "valibot";

export const objectStorageOptionsSchema = v.object({
  endpoint: v.pipe(v.string(), v.url()),
  bucket: v.pipe(v.string(), v.minLength(1)),
  accessKeyId: v.pipe(v.string(), v.minLength(1)),
  secretAccessKey: v.pipe(v.string(), v.minLength(1)),
  region: v.pipe(v.string(), v.minLength(1)),
});

export type ObjectStorageConfiguration = v.InferOutput<typeof objectStorageOptionsSchema>;
