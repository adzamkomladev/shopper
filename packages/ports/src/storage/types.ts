import type { ObjectStorageConfiguration } from "../schemas/storage";

export type ObjectStorageOptions = ObjectStorageConfiguration & { now?: () => number };

export interface BlobUrlOptions {
  baseUrl: string;
  secret: Uint8Array;
  now?: () => number;
}
