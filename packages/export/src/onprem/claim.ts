import { and, eq, inArray, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import type { Licence } from "@shopper/core/licence";
import { boxMove, device, exportJob, type ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { exportPrefix } from "../archive/ids";
import { ImportError } from "../import/error";
import { issueRelocations } from "../move/commit";
import { credentials } from "../move/credentials";

/**
 * The box the move's licence was issued to claims it: it holds this move's sealed archive, so it is handed the
 * credentials the archive leaves out and one relocation code per register (as hashes; the signed messages wait here
 * for each register's handshake once the box has verified what it holds). Claiming again, after a box failed mid-way,
 * issues fresh codes.
 */
export async function claimOnPremMove(
  db: ShopperDatabase,
  deps: { blobs: Blobs; issuerKey: string; appVersion: string },
  input: { licence: Licence; upstream: string; manifestSha256: string; now?: Date },
) {
  const orgId = input.licence.org;
  const [found] = await db
    .select({ move: boxMove, archive: exportJob.status })
    .from(boxMove)
    .innerJoin(exportJob, and(eq(exportJob.orgId, orgId), eq(exportJob.id, boxMove.exportJobId)))
    .where(eq(boxMove.orgId, orgId));
  const move = found?.move;
  if (move && move.licenceId !== input.licence.id)
    throw new ImportError("This licence was not issued for this move.", 403);
  // Verified, but the box never heard: it resumes with what it holds (no new codes, the registers have theirs).
  if (move?.status === "archived")
    return { credentials: await credentials(db, orgId), codes: undefined };
  if (!move || !["open", "claimed"].includes(move.status))
    throw new ImportError("This shop has no move waiting for a box.", 409);
  if (found.archive !== "ready") throw new ImportError("The archive is not sealed yet.", 409);
  const sealed = await deps.blobs.get(orgId, `${exportPrefix(move.exportJobId)}/manifest.json`);
  if (!sealed || (await sha256(sealed)) !== input.manifestSha256)
    throw new ImportError(
      "This is not the archive this move sealed. Download it again from the cloud.",
      409,
    );
  const registers = await db
    .select({ id: device.id })
    .from(device)
    .where(eq(device.orgId, orgId))
    .orderBy(device.id);
  const issued = await issueRelocations(deps.issuerKey, {
    orgId,
    upstream: input.upstream,
    deviceIds: registers.map((register) => register.id),
    now: input.now,
  });
  await markClaimed(
    db,
    { orgId, appVersion: deps.appVersion },
    {
      moveId: move.id,
      upstream: input.upstream,
      relocations: Object.fromEntries(
        issued.map((each) => [
          each.deviceId,
          { message: JSON.stringify(each.relocation), deliveredAt: null },
        ]),
      ),
    },
  );
  return {
    credentials: await credentials(db, orgId),
    codes: Object.fromEntries(issued.map((each) => [each.deviceId, each.stored])),
  };
}

const markClaimed = defineCommand({
  name: "migration.onprem.claim",
  async run(
    tx,
    _ctx,
    input: {
      moveId: string;
      upstream: string;
      relocations: Record<string, { message: string; deliveredAt: null }>;
    },
  ) {
    const updated = await tx
      .update(boxMove)
      .set({
        status: "claimed",
        boxUpstream: input.upstream,
        relocations: input.relocations,
        updatedAt: sql`now()`,
      })
      // Called off while the codes were being made: nothing is claimed.
      .where(and(eq(boxMove.id, input.moveId), inArray(boxMove.status, ["open", "claimed"])))
      .returning({ id: boxMove.id });
    if (!updated.length) throw new ImportError("This move was called off.", 409);
    return { registers: Object.keys(input.relocations).length };
  },
  audit: (input, output) => ({
    moveId: input.moveId,
    upstream: input.upstream,
    registers: output.registers,
  }),
});

/** A register's handshake handed it its relocation to the box: recorded once, for the move screen. */
export const deliverBoxRelocation = defineCommand({
  name: "migration.onprem.deliver",
  async run(tx, _ctx, input: { moveId: string; deviceId: string }) {
    await tx
      .update(boxMove)
      .set({
        relocations: sql`jsonb_set(${boxMove.relocations}, ${`{${input.deviceId},deliveredAt}`}::text[], to_jsonb(now()::text))`,
        updatedAt: sql`now()`,
      })
      .where(eq(boxMove.id, input.moveId));
    return { deviceId: input.deviceId };
  },
  audit: (input) => ({ deviceId: input.deviceId }),
});
