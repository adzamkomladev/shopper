import * as v from "valibot";
import type { Workflow } from "@shopper/ports";
import { archiveFiscalHour, fiscalArchiveId } from "../fiscal/archive";
import { fiscalArchiveParams } from "../schemas/fiscal/archive";
import type { FiscalArchiveDeps } from "./types";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;
/** How long after the hour ends the bundle waits for documents accepted in its last moments. */
export const ARCHIVE_GRACE_MS = 5 * 60_000;

/** One store-hour of the six-year fiscal archive: wait for the hour to end, then bundle what was accepted. */
export async function runFiscalArchive(
  flow: Pick<Workflow, "instanceId" | "step" | "sleepUntil">,
  deps: FiscalArchiveDeps,
  raw: unknown,
) {
  const params = v.parse(fiscalArchiveParams, raw);
  const hour = new Date(params.hour);
  if (flow.instanceId !== fiscalArchiveId(params.orgId, params.storeId, hour))
    throw new Error("Fiscal archive instance must be its store-hour key");
  await flow.sleepUntil("hour-end", new Date(hour.getTime() + 3_600_000 + ARCHIVE_GRACE_MS));
  await flow.step("bundle", policy, () =>
    deps.withDatabase((db) =>
      archiveFiscalHour(
        db,
        { orgId: params.orgId, appVersion: deps.appVersion },
        { storeId: params.storeId, hour: params.hour, blobs: deps.blobs },
        {
          instanceId: flow.instanceId,
          businessKey: flow.instanceId,
          type: "fiscal-archive",
          step: "bundle",
          status: "completed",
        },
      ),
    ),
  );
}
