import { eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit/sqlite";
import { shift } from "@shopper/db-sqlite";

type Mark = { id: string };
const entity = (input: Mark) => ({ entity: "shift", entityId: input.id });

/** The server recorded the shift; `result` is what it answered. */
export const markShiftAccepted = defineCommand({
  name: "shift.accept",
  async run(tx, _context, input: Mark & { result: Record<string, unknown>; at: Date }) {
    await tx
      .update(shift)
      .set({ acceptedAt: input.at.toISOString(), result: input.result, nextAttemptAt: null })
      .where(eq(shift.id, input.id));
  },
  audit: (input) => ({ shiftId: input.id }),
  details: entity,
});

/** Terminal: the server refused the shift; it stays listed with the reason and is never retried. */
export const markShiftRejected = defineCommand({
  name: "shift.reject",
  async run(tx, _context, input: Mark & { code: string; reason: string }) {
    await tx
      .update(shift)
      .set({ blockedCode: input.code, blockedReason: input.reason, nextAttemptAt: null })
      .where(eq(shift.id, input.id));
  },
  audit: (input) => ({ shiftId: input.id, code: input.code, reason: input.reason }),
  details: entity,
});

/** Counts a failed attempt and defers the next one to `nextAttemptAt` (epoch ms). */
export const markShiftFailed = defineCommand({
  name: "shift.upload.failed",
  async run(tx, _context, input: Mark & { nextAttemptAt: number; reason: string }) {
    await tx
      .update(shift)
      .set({ attempts: sql`${shift.attempts} + 1`, nextAttemptAt: input.nextAttemptAt })
      .where(eq(shift.id, input.id));
  },
  audit: (input) => ({ shiftId: input.id, reason: input.reason }),
  details: entity,
});
