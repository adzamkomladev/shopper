import type {
  Blobs,
  Lane,
  Cache,
  Json,
  Queue,
  QueueHandler,
  Renderer,
  Sequencer,
  Workflow,
  WorkflowLauncher,
} from "@shopper/ports";

export interface AcceptedSaleFixture {
  orgId: string;
  otherOrgId: string;
  storeId: string;
  otherStoreId: string;
  deviceId: string;
  otherDeviceId: string;
  localId: string;
  missingLocalId: string;
  inspect(): Promise<{ sequence: bigint | null; assignmentAudits: number }>;
  failAssignmentAudit(): Promise<() => Promise<void>>;
}

export interface AdapterFixture {
  orgId: string;
  otherOrgId: string;
  storeId: string;
  cache: Cache;
  blobs: Blobs;
  sequencer: Sequencer;
  workflow(instanceId: string): Workflow;
  advanceClock(ms: number): void;
  readSigned(url: string, blobs: Pick<Blobs, "get">): Promise<Uint8Array | null>;
  reopen(): Promise<{ cache: Cache; sequencer: Sequencer }>;
  sequenceRecord(): Promise<bigint>;
  provisionPendingSale(): Promise<AcceptedSaleFixture>;
}

export type ConformanceTest = (name: string, run: () => Promise<void>) => unknown;
export type Fixture = () => Promise<AdapterFixture>;
export type SaleSequencerFixture = Fixture;

export interface WorkflowLauncherFixture {
  launcher: WorkflowLauncher;
  instanceId: string;
  params: Json;
  waitForEnd(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}
export type LauncherFixture = (expired: boolean) => Promise<WorkflowLauncherFixture>;

export interface RendererFixture {
  renderer: Renderer;
  receipt: Json;
  /** A statement document; adapters that render statements (not the till host) supply one. */
  statement?: Json;
  close(): Promise<void>;
}

export type QueueFixture = (handler: QueueHandler) => Promise<{
  queue: Queue;
  // Resolves once every delivery and redelivery has run.
  settle(): Promise<void>;
}>;

export interface LaneFixture {
  lane: Lane;
  orgId: string;
  storeId: string;
  otherStoreId: string;
  /** Pending fiscal documents for a store, numbered `${prefix}-1`… in the order given. */
  docs(storeId: string, prefix: string, count: number): Promise<string[]>;
  /** Steers the SDC fake, which may run in another process. Arrivals are invoice numbers, oldest first. */
  sdc: {
    failNext(count: number): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
    arrivals(): Promise<string[]>;
  };
  /** Runs the store's lane, firing backoff timers at once, until it is empty or has made `rounds` tries. */
  drain(storeId: string, rounds?: number): Promise<void>;
  status(docId: string): Promise<string>;
  /** Replaces the lane as after a restart (box) or an eviction (Durable Object). */
  reopen(): Promise<void>;
  close(): Promise<void>;
}
