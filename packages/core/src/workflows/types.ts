import { type ShopperDatabase } from "@shopper/db-pg";
import { type Blobs, type Queue, type Realtime, type WorkflowLauncher } from "@shopper/ports";

export interface PriceChangeDeps {
  // Each step opens its own connection: workflows outlive the request that started them.
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  realtime: Realtime;
  appVersion: string;
}

export interface AccountFlowDeps {
  // Each step opens its own connection: workflows outlive the request that started them.
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Carries tier notices to the notification consumer. */
  queue?: Queue;
}

export interface StatementFlowDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Carries the fanned-out statements to the notification consumer. */
  queue?: Queue;
}

export interface FiscalArchiveDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Where the hourly bundles are written: R2 in the cloud, RustFS or the filesystem on a box. */
  blobs: Blobs;
}

export interface AuditAnchorDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Carries the owners' anchor emails to the notification consumer. */
  queue?: Queue;
}

export interface StoreDayDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Carries the owners' reminder and summary emails to the notification consumer. */
  queue?: Queue;
  /** Starts the store's next day, so the chain goes on by itself. */
  storeDays: WorkflowLauncher;
}

export interface OnboardingFlowDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  appVersion: string;
  /** Carries the owners' nudges to the notification consumer. */
  queue?: Queue;
  /** The signup's verification email flow, asked to send its link again as a reminder. */
  authFlows?: WorkflowLauncher;
  now?: () => number;
}
