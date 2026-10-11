import type { Blobs, Cache, Sequencer, Workflow } from "@shopper/ports";

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
}

export type ConformanceTest = (name: string, run: () => Promise<void>) => unknown;
export type Fixture = () => Promise<AdapterFixture>;
