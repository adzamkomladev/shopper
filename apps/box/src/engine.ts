import { boxQueue, launchQueue, memoryLaunch, rivetHost } from "@shopper/adapters-box";
import type { QueueHandler, RetryPolicy } from "@shopper/ports";

/** Where the box runs its workflows and queue: on the Rivet engine when `RIVET_ENDPOINT` is set, else in this process. */
export function boxEngine(environment: Record<string, string | undefined>) {
  if (!environment.RIVET_ENDPOINT) return { launch: memoryLaunch, queue: boxQueue };
  const host = rivetHost({
    endpoint: environment.RIVET_ENDPOINT,
    token: environment.RIVET_TOKEN ?? "",
    namespace: environment.RIVET_NAMESPACE ?? "default",
    pool: environment.RIVET_POOL ?? "shopper-box",
  });
  return {
    launch: host.launch,
    queue: (policy: RetryPolicy, handler: QueueHandler) =>
      launchQueue(policy, handler, host.launch),
  };
}
