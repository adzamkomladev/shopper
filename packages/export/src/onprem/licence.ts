import { and, count, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand } from "@shopper/audit";
import { licenceFromRequest } from "@shopper/core/licence";
import { boxMove, device, org } from "@shopper/db-pg";
import { ImportError } from "../import/error";

/** A site licence covers five registers, more when the shop already runs more. */
const MIN_TERMINALS = 5;

/**
 * The box's licence, issued by the cloud for this move only: this org, the machine and key in the request code the box
 * shows, as many registers as the shop has (at least five) and a year of maintenance. Issuing again before the box
 * claims replaces it.
 * Pricing and payment of the licence are not part of the move.
 */
export const issueMoveLicence = defineCommand({
  name: "migration.onprem.licence",
  async run(tx, ctx, input: { issuerKey: string; request: string; now?: Date }) {
    const [move] = await tx
      .select({ id: boxMove.id, status: boxMove.status })
      .from(boxMove)
      .where(eq(boxMove.orgId, ctx.orgId))
      .for("update");
    if (move?.status !== "open")
      throw new ImportError("A licence is issued only while the move waits for its box.", 409);
    const [shop] = await tx.select({ name: org.name }).from(org).where(eq(org.id, ctx.orgId));
    const [registers] = await tx
      .select({ n: count() })
      .from(device)
      .where(eq(device.orgId, ctx.orgId));
    const now = input.now ?? new Date();
    const until = new Date(now);
    until.setUTCFullYear(until.getUTCFullYear() + 1);
    const licence = await licenceFromRequest(input.issuerKey, input.request, {
      id: v7(),
      org: ctx.orgId,
      site: shop!.name,
      terminals: Math.max(MIN_TERMINALS, registers!.n),
      issuedAt: now.toISOString(),
      maintenanceUntil: until.toISOString().slice(0, 10),
    });
    if (!licence)
      throw new ImportError("That is not a box's request code. Copy it again from the box.", 422);
    await tx
      .update(boxMove)
      .set({ licenceId: licence.id, licence, updatedAt: sql`now()` })
      .where(and(eq(boxMove.id, move.id)));
    return licence;
  },
  // The licence is public; the issuer key never reaches the audit row.
  audit: (_input, licence) => ({
    licenceId: licence.id,
    machine: licence.machine,
    terminals: licence.terminals,
  }),
});
