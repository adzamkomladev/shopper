import * as v from "valibot";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import {
  localSale,
  refund,
  shift,
  shiftMovement,
  tillStaff,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import { refundEvent } from "../../schemas/till/refund";
import { saleSnapshot } from "../../schemas/till/sale";
import { TillError } from "../error";
import { findRegisterSettings } from "../register/settings";

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

/** Everything a shift report is built from: its sales, refunds, cash movements and the names of who took part. */
export async function readShiftParts(tx: TillSqlite, found: typeof shift.$inferSelect) {
  const sales = await tx
    .select({ payload: localSale.payload })
    .from(localSale)
    .where(
      and(
        eq(localSale.orgId, found.orgId),
        eq(localSale.shiftId, found.id),
        eq(localSale.status, "completed"),
      ),
    )
    .orderBy(asc(localSale.id));
  const refunds = await tx
    .select({ payload: refund.payload })
    .from(refund)
    .where(and(eq(refund.orgId, found.orgId), eq(refund.shiftId, found.id)))
    .orderBy(asc(refund.id));
  const movements = await tx
    .select()
    .from(shiftMovement)
    .where(and(eq(shiftMovement.orgId, found.orgId), eq(shiftMovement.shiftId, found.id)))
    .orderBy(asc(shiftMovement.at), asc(shiftMovement.id));
  const parts = {
    shift: found,
    sales: sales.map((row) => v.parse(saleSnapshot, row.payload)),
    refunds: refunds.map((row) => v.parse(refundEvent, row.payload).refund),
    movements,
  };
  const people = [
    found.openedBy,
    ...parts.sales.map((s) => s.cashierId),
    ...parts.refunds.map((r) => r.cashierId),
    ...movements.map((m) => m.actorId),
  ];
  const ids = [...new Set(people)];
  const staff = await tx
    .select({ userId: tillStaff.userId, name: tillStaff.name })
    .from(tillStaff)
    .where(and(eq(tillStaff.orgId, found.orgId), inArray(tillStaff.userId, ids)));
  const names = new Map(staff.map((row) => [row.userId, row.name]));
  const settings = await findRegisterSettings(tx, found);
  return {
    ...parts,
    registerName: settings?.value.registerName ?? null,
    cashiers: ids.map((userId) => ({ userId, name: names.get(userId) ?? null })),
  };
}
