import { boxBlobs } from "@shopper/adapters-box";

/** The box's blobs: local files, with imports and receipts in S3 (RustFS) buckets when `SHOPPER_S3_*` is set. */
export async function boxStorage(
  environment: Record<string, string | undefined>,
  options: { baseUrl: string; secret: string },
) {
  const s3 = (bucket?: string) =>
    environment.SHOPPER_S3_ENDPOINT && bucket
      ? {
          endpoint: environment.SHOPPER_S3_ENDPOINT,
          bucket,
          accessKeyId: environment.SHOPPER_S3_ACCESS_KEY_ID ?? "",
          secretAccessKey: environment.SHOPPER_S3_SECRET_ACCESS_KEY ?? "",
          region: environment.SHOPPER_S3_REGION ?? "",
        }
      : undefined;
  const storage = await boxBlobs(environment.SHOPPER_BLOBS_PATH ?? ".shopper/blobs", {
    baseUrl: options.baseUrl,
    secret: new TextEncoder().encode(options.secret),
    objectStorage: s3(environment.SHOPPER_S3_BUCKET),
    receiptsObjectStorage: s3(environment.SHOPPER_S3_RECEIPTS_BUCKET),
  });
  return storage.blobs;
}
