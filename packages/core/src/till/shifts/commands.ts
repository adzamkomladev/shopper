import * as v from "valibot";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { shift, shiftMovement, type TillDatabase, type TillSqlite } from "@shopper/db-sqlite";
import { tillConfiguration } from "../../schemas/till/config";
import { tillSession } from "../../schemas/till/session";
import { countedCash, dropCashInput, noSaleInput, openShiftInput } from "../../schemas/till/shifts";
import { TillError } from "../error";
import { checkSession, hostTime } from "../session";
import { findShift, requireOpenShift } from "./queries";
import type { Prepared } from "./types";

/** Opens the register's shift with its float, given as an amount or counted by denomination. */
export async function openShift(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const input = v.parse(openShiftInput, raw);
  const prepared = await prepare(db, rawConfig, rawSession, input.at, "shift.write");
  return open(db, contextOf(prepared), {
    ...prepared,
    float: "counts" in input ? countedCash(input.counts) : input.float,
    counts: "counts" in input ? input.counts : null,
  });
}

/** Takes cash out of the drawer to the safe. Never limited by the expected cash, which would reveal it. */
export async function dropCash(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const input = v.parse(dropCashInput, raw);
  const prepared = await prepare(db, rawConfig, rawSession, input.at, "shift.write");
  return drop(db, contextOf(prepared), {
    ...prepared,
    amount: input.amount,
    reason: input.reason || null,
  });
}

/** Opens the drawer without a sale; the reason is kept with the shift and the audit row. */
export async function recordNoSale(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const input = v.parse(noSaleInput, raw);
  const prepared = await prepare(db, rawConfig, rawSession, input.at, "shift.write");
  return noSale(db, contextOf(prepared), { ...prepared, amount: 0, reason: input.reason });
}

const open = defineCommand({
  name: "shift.open",
  async run(
    tx,
    _context,
    input: Prepared & { float: number; counts: Record<string, number> | null },
  ) {
    if (await findShift(tx, input.config))
      throw new TillError("SHIFT_OPEN", "This register already has an open shift");
    const [row] = await tx
      .insert(shift)
      .values({
        id: v7(),
        orgId: input.config.orgId,
        deviceId: input.config.deviceId,
        branchId: input.config.branchId,
        storeId: input.config.storeId,
        status: "open",
        openedAt: input.time.toISOString(),
        openedBy: input.session.userId,
        openedSessionId: input.session.id,
        float: input.float,
        floatCounts: input.counts,
      })
      .returning();
    return row!;
  },
  audit: (_input, output) => ({
    shiftId: output.id,
    float: output.float,
    counts: output.floatCounts,
  }),
  details: (_input, output) => ({ entity: "shift", entityId: output.id }),
});

type Movement = Prepared & { amount: number; reason: string | null };
const move = (kind: "drop" | "no_sale") =>
  async function run(tx: TillSqlite, _context: unknown, input: Movement) {
    const found = await requireOpenShift(tx, input.config);
    const [row] = await tx
      .insert(shiftMovement)
      .values({
        id: v7(),
        orgId: found.orgId,
        shiftId: found.id,
        kind,
        amount: input.amount,
        reason: input.reason,
        actorId: input.session.userId,
        sessionId: input.session.id,
        at: input.time.toISOString(),
      })
      .returning();
    return row!;
  };
const movementDetails = (_input: unknown, output: { shiftId: string }) => ({
  entity: "shift",
  entityId: output.shiftId,
});

const drop = defineCommand({
  name: "shift.drop",
  run: move("drop"),
  audit: (_input, output) => ({
    movementId: output.id,
    amount: output.amount,
    reason: output.reason,
  }),
  details: movementDetails,
});

const noSale = defineCommand({
  name: "shift.nosale",
  run: move("no_sale"),
  audit: (_input, output) => ({ movementId: output.id, reason: output.reason }),
  details: movementDetails,
});

/** Parses the shared inputs and checks the session holds `permission` at the corrected time. */
export async function prepare(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  at: Date,
  permission: string,
): Promise<Prepared> {
  const config = v.parse(tillConfiguration, rawConfig);
  const session = v.parse(tillSession, rawSession);
  const time = await hostTime(db, config, at);
  checkSession(session, config, permission, time);
  return { config, session, time, deviceTime: at };
}

export const contextOf = ({ config, session, deviceTime }: Prepared) => ({
  orgId: config.orgId,
  deviceId: config.deviceId,
  branchId: config.branchId,
  actorId: session.userId,
  role: session.roleName,
  appVersion: config.appVersion,
  deviceTime,
});
