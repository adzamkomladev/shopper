import type { cloudflareLauncher } from "../launcher";
import type { cloudflareLive } from "../live";
import type { cloudflareSequencer } from "../sequencer";

export interface AuthEnvironment {
  SHOPPER_S3_ENDPOINT?: string;
  SHOPPER_S3_BUCKET?: string;
  SHOPPER_S3_ACCESS_KEY_ID?: string;
  SHOPPER_S3_SECRET_ACCESS_KEY?: string;
  SHOPPER_S3_REGION?: string;
  SHOPPER_AUTH_SECRET?: string;
  SHOPPER_AUTH_URL?: string;
  SHOPPER_BOOTSTRAP_TOKEN?: string;
  SHOPPER_LINK_SECRET?: string;
  MAILEROO_API_KEY?: string;
  MAILEROO_FROM?: string;
  MAILEROO_ENDPOINT?: string;
  SHOPPER_ENVIRONMENT?: string;
}

export interface CloudflareRuntimeEnvironment extends AuthEnvironment {
  HYPERDRIVE: Hyperdrive;
  BLOBS: R2Bucket;
  IMPORTS: R2Bucket;
  CACHE_DB: D1Database;
  STORE_SEQUENCER: Parameters<typeof cloudflareSequencer>[0];
  STORE_HUB: Parameters<typeof cloudflareLive>[0];
  PRICE_CHANGE: Parameters<typeof cloudflareLauncher>[0];
  AUTH_FLOWS?: Parameters<typeof cloudflareLauncher>[0];
}
