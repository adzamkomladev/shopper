import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit/sqlite";
import { tillState, type TillDatabase } from "@shopper/db-sqlite";

const toleranceMs = 60_000;

/**
 * Keeps `till_state.clock_offset_ms` true between handshakes. The offset is measured only from server
 * replies, so a wall clock set back while offline would date every later sale (and its session check)
 * by the stale offset. Each measurement anchors server time to the monotonic clock (`measured`, called
 * as the handshake reply is saved); `check` runs before each register request and rewrites the
 * offset when the wall clock has fallen behind that anchor.
 *
 * Only a measurement taken in this process anchors: the wall clock at start-up proves nothing. Only
 * backward jumps are corrected: on Linux and macOS the monotonic clock stops while the computer
 * sleeps, so a forward jump looks exactly like a night in suspend. It drops the anchor instead, and
 * nothing is corrected until the next handshake measures again.
 */
export function createClockAnchor(
  database: TillDatabase,
  config: { orgId: string; deviceId: string; appVersion: string },
  monotonic = () => performance.now(),
) {
  const scope = and(eq(tillState.orgId, config.orgId), eq(tillState.deviceId, config.deviceId));
  const correct = defineCommand({
    name: "till.clock.correct",
    async run(tx, _ctx, input: { previousMs: number; offsetMs: number }) {
      // Conditional: a handshake that measured the offset in the meantime wins.
      await tx
        .update(tillState)
        .set({ clockOffsetMs: input.offsetMs })
        .where(and(scope, eq(tillState.clockOffsetMs, input.previousMs)));
    },
    audit: (input) => input,
  });
  let anchor: { offsetMs: number; serverMs: number; monoMs: number } | undefined;
  return {
    measured(offsetMs: number) {
      anchor = { offsetMs, serverMs: Date.now() - offsetMs, monoMs: monotonic() };
    },
    async check() {
      if (!anchor) return;
      const offsetMs = Math.round(Date.now() - (anchor.serverMs + monotonic() - anchor.monoMs));
      if (offsetMs > anchor.offsetMs + toleranceMs) {
        anchor = undefined;
        return;
      }
      if (offsetMs >= anchor.offsetMs - toleranceMs) return;
      await correct(database, config, { previousMs: anchor.offsetMs, offsetMs });
      anchor = { ...anchor, offsetMs };
    },
  };
}
