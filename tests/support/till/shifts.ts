// Helpers for the shift suites. Production API assumed (all from @shopper/core/till, `at` = corrected till time):
//   openShift(db, config, session, { at, float?, counts? })  -> the opened shift row (camelCase mirror, has `id`)
//   currentShift(db, scope)                                  -> the open or declared shift of the register, or null
// `insertOpenShift` writes a shift row directly (no audit row) so suites that only need a register that may sell do
// not change their audit counts.
import { eq } from "drizzle-orm";
import { shift, type TillDatabase } from "@shopper/db-sqlite";
import { config, ids, session } from "./sales";

export const shiftId = "019a0000-0000-7000-8000-0000000000f1";
export const earlierShiftId = "019a0000-0000-7000-8000-0000000000f0";
export const shifter = { ...session, permissions: [...session.permissions, "shift.write"] };

/** Face values in money minor units (1 GHS = 10 000), largest first: GHS 200 down to the one-pesewa coin. */
export const faces = [
  2_000_000, 1_000_000, 500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500,
  100,
] as const;

export type ShiftRow = typeof shift.$inferInsert;

/** Inserts a shift directly. Defaults: the golden register, open, a GHS 200 float opened by the golden cashier. */
export function insertOpenShift(db: TillDatabase, over: Partial<ShiftRow> = {}) {
  return db.transaction((tx) =>
    tx.insert(shift).values({
      id: shiftId,
      orgId: ids.org,
      deviceId: ids.device,
      branchId: ids.branch,
      storeId: config.storeId,
      status: "open",
      openedAt: "2025-12-01T00:00:00.000Z",
      openedBy: ids.cashier,
      openedSessionId: ids.session,
      float: 2_000_000,
      ...over,
    }),
  );
}

export const shiftRows = (db: TillDatabase) => db.read((tx) => tx.select().from(shift));

/** Moves every shift to `status` without going through a command, as a close or a count would. */
export const setShiftStatus = (db: TillDatabase, status: "declared" | "closed") =>
  db.transaction((tx) =>
    tx
      .update(shift)
      .set(status === "closed" ? { status, closedAt: "2025-12-02T00:00:00.000Z" } : { status })
      .where(eq(shift.orgId, ids.org)),
  );
