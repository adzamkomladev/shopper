// Closes a shift on the push fixture's till, as its cashier, for the shift upload suites.
//   declareFixtureShift()    -> counts exactly what the X says is expected and stops there
//   closeFixtureShift()      -> declares as above, then closes: the Z; counts exactly what the X says is expected, so nobody needs to approve
//   freshShift()             -> gives the fixture till's open shift a new id: the server keeps one content per id
//   shiftRow(id)             -> the till's `shift` row
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { closeShift, declareShift, readShiftReport } from "@shopper/core/till";
import { shift } from "@shopper/db-sqlite";
import { config } from "../till/sales";
import { denominate } from "../till/close";
import { context, databases, deviceId, hostConfiguration } from "../till/server";

export const declareAt = new Date("2025-12-31T23:40:00.000Z");
export const closeAt = new Date("2025-12-31T23:50:00.000Z");

export const shiftRow = async (id: string) =>
  (await databases().local.read((tx) => tx.select().from(shift).where(eq(shift.id, id))))[0]!;

/** Call before the shift is used: the fixture's shift id is constant and the server keeps what it accepted. */
export const freshShift = () =>
  databases().local.transaction((tx) => tx.update(shift).set({ id: v7() }));

async function declareExactly() {
  const db = databases().local;
  const { session } = await hostConfiguration(":memory:", []);
  const till = { ...config, orgId: context.orgId, deviceId };
  const reader = { ...session!, permissions: [...session!.permissions, "report.read"] };
  const x = await readShiftReport(db, till, reader, { at: declareAt });
  const owed = Object.fromEntries(x.tenders.map((row) => [row.tender, row.expected]));
  await declareShift(db, till, session, {
    at: declareAt,
    counts: denominate(owed.cash!),
    card: owed.card,
    momo: owed.momo,
  });
  return { db, till, session };
}

/** Counts the drawer and stops there: the shift is declared, not closed. */
export const declareFixtureShift = async () => void (await declareExactly());

export async function closeFixtureShift() {
  const { db, till, session } = await declareExactly();
  return closeShift(db, till, session, { at: closeAt });
}
