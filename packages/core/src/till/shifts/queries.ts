import { and, eq, ne } from "drizzle-orm";
import { shift, type TillDatabase, type TillSqlite } from "@shopper/db-sqlite";
import { TillError } from "../error";

type Register = { orgId: string; deviceId: string };

/** The register's open or counted shift, or `null` when it is closed. */
export function currentShift(db: TillDatabase, register: Register) {
  return db.read((tx) => findShift(tx, register));
}

export async function findShift(tx: TillSqlite, register: Register) {
  const [row] = await tx
    .select()
    .from(shift)
    .where(
      and(
        eq(shift.orgId, register.orgId.toLowerCase()),
        eq(shift.deviceId, register.deviceId.toLowerCase()),
        ne(shift.status, "closed"),
      ),
    );
  return row ?? null;
}

/** The open shift money may move in; a closed register is SHIFT_REQUIRED and a counted one SHIFT_COUNTED. */
export async function requireOpenShift(tx: TillSqlite, register: Register) {
  const found = await findShift(tx, register);
  if (!found) throw new TillError("SHIFT_REQUIRED", "Register closed. Open a shift");
  if (found.status !== "open")
    throw new TillError("SHIFT_COUNTED", "The drawer is counted. Close the shift");
  return found;
}
