import type {
  Blobs,
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
