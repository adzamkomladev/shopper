import { cacheCases } from "./cases/cache";
import { blobsCases } from "./cases/blobs";
import { sequencerCases } from "./cases/sequencer";
import { workflowCases } from "./cases/workflow";
import type { ConformanceTest, Fixture } from "./types";

export type { AdapterFixture } from "./types";

// Vitest 4 (workerd) and Vite+ both register these exact cases; no emulated ports.
export function portConformance(name: string, test: ConformanceTest, fixture: Fixture) {
  cacheCases(name, test, fixture);
  blobsCases(name, test, fixture);
  sequencerCases(name, test, fixture);
  workflowCases(name, test, fixture);
}
export { realtimeConformance, type RealtimeFixture } from "./cases/realtime";
export { workflowLauncherConformance } from "./cases/launcher";
export type { WorkflowLauncherFixture } from "./types";
