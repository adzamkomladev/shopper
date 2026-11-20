import * as v from "valibot";
import type { Workflow } from "@shopper/ports";
import { publishPending, recordRelayError } from "../relay/publisher";
import { relayPublisherParams } from "../schemas/relay";
import type { RelayPublisherDeps } from "./types";
import { LAST_WAKE_MS, woken } from "./wait";
export type { RelayPublisherDeps } from "./types";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "exponential" } as const;
/** First retry after the relay could not be reached, doubling up to the cap. */
const RETRY_MS = 60_000;
const MAX_RETRY_MS = 15 * 60_000;

/**
 * The box's Publisher (v1.5): send the relay org what changed, then the heartbeat (Day 49), then end; a catalogue write or the Online Orders switch
 * starts it again (a start on a running loop is a wake). When the relay cannot be reached it keeps the reason and
 * tries again later, sooner if woken; a refusal (not enrolled, add-on off, maintenance lapsed) ends the run.
 * PostgreSQL is the record: what the relay acknowledged is in `relay_published`, so a rerun sends nothing twice.
 */
export async function runRelayPublisher(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: RelayPublisherDeps,
  raw: unknown,
) {
  const { orgId } = v.parse(relayPublisherParams, raw);
  if (orgId !== flow.instanceId) throw new Error("Publisher instance must equal its org id");
  const context = { orgId, appVersion: deps.appVersion };
  let retry = RETRY_MS;
  for (let tick = 0; ; tick++) {
    const failed = await flow.step(`publish-${tick}`, policy, () =>
      deps.withDatabase(async (db) => {
        const error = await publishPending(db, context, deps).then(
          async (result) => {
            if ("refused" in result || "off" in result) return null;
            // Alive only once what is due is on the relay: a reconnecting box never reopens ordering on stale stock.
            const beat = await deps.send("/relay/heartbeat", { method: "POST", body: "{}" });
            return beat.ok ? null : `The relay answered ${beat.status}`;
          },
          (thrown: unknown) => (thrown instanceof Error ? thrown.message : String(thrown)),
        );
        if (error)
          await recordRelayError(db, context, {
            error: `Shopper could not be reached: ${error}`,
            retrying: true,
          });
        return !!error;
      }),
    );
    if (failed) {
      await woken(flow, `retry-${tick}`, retry);
      retry = Math.min(retry * 2, MAX_RETRY_MS);
      continue;
    }
    retry = RETRY_MS;
    // Cloudflare drops a wake sent as an instance ends: take one already buffered before ending.
    if (await woken(flow, `last-${tick}`, LAST_WAKE_MS)) continue;
    return;
  }
}
