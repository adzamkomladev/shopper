import type { cloudflareQueue } from "../queue";
import type { cloudflareRenderer } from "../renderer";
import type { cloudflareLauncher, cloudflareLoopLauncher } from "../launcher";
import type { cloudflareLive } from "../live";
import type { cloudflareSequencer } from "../sequencer";

export interface AuthEnvironment {
  SHOPPER_S3_ENDPOINT?: string;
  SHOPPER_S3_BUCKET?: string;
  SHOPPER_S3_RECEIPTS_BUCKET?: string;
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
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_BASE_URL?: string;
  ARKESEL_API_KEY?: string;
  ARKESEL_SENDER?: string;
  ARKESEL_BASE_URL?: string;
}

export interface CloudflareRuntimeEnvironment extends AuthEnvironment {
  HYPERDRIVE: Hyperdrive;
  BLOBS: R2Bucket;
  IMPORTS: R2Bucket;
  RECEIPTS: R2Bucket;
  CACHE_DB: D1Database;
  STORE_SEQUENCER: Parameters<typeof cloudflareSequencer>[0];
  STORE_HUB: Parameters<typeof cloudflareLive>[0];
  PRICE_CHANGE: Parameters<typeof cloudflareLauncher>[0];
  NOTIFICATIONS?: Parameters<typeof cloudflareQueue>[0];
  MOMO_PAYMENT?: Parameters<typeof cloudflareLauncher>[0];
  AUTH_FLOWS?: Parameters<typeof cloudflareLauncher>[0];
  BROWSER?: Parameters<typeof cloudflareRenderer>[0];
  KYC_FLOWS?: Parameters<typeof cloudflareLauncher>[0];
  ACCOUNT_FLOWS?: Parameters<typeof cloudflareLoopLauncher>[0];
  STATEMENT_FLOWS?: Parameters<typeof cloudflareLoopLauncher>[0];
}
