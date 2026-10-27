// A store-day world on the golden till: on 14 Oct a sale and then the register's Z; on 15 Oct a sale and no Z.
// The golden org's admin is made its owner, who receives the reminder and the summary.
import { asc, eq } from "drizzle-orm";
import type { Json, WorkflowLauncher } from "@shopper/ports";
import { auditLog } from "@shopper/db-pg";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { ids } from "../../fixtures/sales/golden";
import { goldenWorld } from "../sales/golden/setup";
import { runGolden } from "../sales/golden/run";
import { postShift, shiftEvent } from "../sales/shifts";
import { portalOwner, protectOwner } from "../api/portal";

export async function dayWorld() {
  const world = await goldenWorld({ since: "2026-10-14T00:00:00.000Z" });
  const owner = await portalOwner(ids.org, ids.cashier);
  await protectOwner(ids.org, owner);
  const momo = tradingDay.find((sale) => sale.name === "exact MoMo")!;
  await runGolden(world, momo, new Date("2026-10-14T10:00:00.000Z"));
  const z = await postShift(
    shiftEvent(world, { closedAt: "2026-10-14T20:00:00.000Z" }),
    world.session.proof,
  );
  if (!z.body.accepted) throw new Error("The day world's Z was refused");
  await runGolden(world, momo, new Date("2026-10-15T12:00:00.000Z"));
  return { world, owner };
}

/** A launcher that only records what it was asked to start. */
export function recordingLauncher() {
  const started: { id: string; params: Json }[] = [];
  const launcher: WorkflowLauncher = {
    start: async (id, params) => void started.push({ id, params }),
    send: async () => undefined,
  };
  return { launcher, started };
}

/** The audit commands the org has run, oldest first, for one prefix. */
export async function commandsRun(
  db: Awaited<ReturnType<typeof dayWorld>>["world"]["db"],
  prefix: string,
) {
  const rows = await db
    .select({ command: auditLog.command })
    .from(auditLog)
    .where(eq(auditLog.orgId, ids.org))
    .orderBy(asc(auditLog.chainSeq));
  return rows
    .map((row) => row.command)
    .filter((command) => command.startsWith(prefix) || command === "report.rollup");
}
