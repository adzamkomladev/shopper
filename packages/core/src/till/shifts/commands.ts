import * as v from "valibot";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit/sqlite";
import { shift, type TillDatabase } from "@shopper/db-sqlite";
import { tillConfiguration } from "../../schemas/till/config";
import { tillSession, type TillSession } from "../../schemas/till/session";
import { countedCash, openShiftInput } from "../../schemas/till/shifts";
import { TillError } from "../error";
import { checkSession, hostTime } from "../session";
import { findShift } from "./queries";

type Config = v.InferOutput<typeof tillConfiguration>;
type Prepared = { config: Config; session: TillSession; time: Date; deviceTime: Date };

/** Opens the register's shift with its float, given as an amount or counted by denomination. */
export async function openShift(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  raw: unknown,
) {
  const input = v.parse(openShiftInput, raw);
  const prepared = await prepare(db, rawConfig, rawSession, input.at);
  return open(db, contextOf(prepared), {
    ...prepared,
    float: "counts" in input ? countedCash(input.counts) : input.float,
    counts: "counts" in input ? input.counts : null,
  });
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

/** Parses the shared inputs and checks the session may run shift commands at the corrected time. */
async function prepare(
  db: TillDatabase,
  rawConfig: unknown,
  rawSession: unknown,
  at: Date,
): Promise<Prepared> {
  const config = v.parse(tillConfiguration, rawConfig);
  const session = v.parse(tillSession, rawSession);
  const time = await hostTime(db, config, at);
  checkSession(session, config, "shift.write", time);
  return { config, session, time, deviceTime: at };
}

const contextOf = ({ config, session, deviceTime }: Prepared) => ({
  orgId: config.orgId,
  deviceId: config.deviceId,
  branchId: config.branchId,
  actorId: session.userId,
  role: session.roleName,
  appVersion: config.appVersion,
  deviceTime,
});
