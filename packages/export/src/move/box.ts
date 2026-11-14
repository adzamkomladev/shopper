import { and, eq, ne, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { cloudMove, type ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";
import { ImportError } from "../import/error";

/** The move's workflow key: one move per attempt (a failed move is started again under a new id). */
export const cloudMoveId = (moveId: string) => `cloud-move_${moveId}`;

/**
 * An owner moves the shop to the cloud. From this row on the box only reads (the snapshot is taken next, and nothing
 * after it would reach the cloud); a move that failed may be started again.
 */
export async function requestCloudMove(
  db: ShopperDatabase,
  context: CommandContext,
  launcher: WorkflowLauncher,
  input: { cloudUrl: string },
) {
  const moved = await startCloudMove(db, context, {
    moveId: v7(),
    // Registers reach a server at its origin (`/sync/...`), so the cloud is named by its API origin.
    cloudUrl: new URL(input.cloudUrl).origin,
  });
  await launcher.start(cloudMoveId(moved.moveId), { orgId: context.orgId, moveId: moved.moveId });
  return moved;
}

export async function getCloudMove(db: ShopperDatabase, orgId: string) {
  const [row] = await db.select().from(cloudMove).where(eq(cloudMove.orgId, orgId));
  return row;
}

const startCloudMove = defineCommand({
  name: "migration.move.start",
  async run(tx, ctx, input: { moveId: string; cloudUrl: string }) {
    const [active] = await tx
      .select({ id: cloudMove.id })
      .from(cloudMove)
      .where(and(eq(cloudMove.orgId, ctx.orgId), ne(cloudMove.status, "failed")));
    if (active) throw new ImportError("This shop is already moving to the cloud.", 409);
    await tx
      .insert(cloudMove)
      .values({
        id: input.moveId,
        orgId: ctx.orgId,
        cloudUrl: input.cloudUrl,
        requestedBy: ctx.actorId,
      })
      .onConflictDoUpdate({
        target: cloudMove.orgId,
        set: {
          id: input.moveId,
          status: "sealing",
          cloudUrl: input.cloudUrl,
          requestedBy: ctx.actorId,
          exportJobId: null,
          importId: null,
          relocations: {},
          error: null,
          completedAt: null,
          updatedAt: sql`now()`,
        },
      });
    return { moveId: input.moveId };
  },
  audit: (input, output) => ({ moveId: output.moveId, cloudUrl: input.cloudUrl }),
});

/** The cloud took the shop: its registers' relocations wait for their next handshake. */
export const finishCloudMove = defineCommand({
  name: "migration.move.finish",
  async run(tx, _ctx, input: { moveId: string; importId: string; relocations: unknown[] }) {
    const relocations = Object.fromEntries(
      input.relocations.map((relocation) => [
        (relocation as { deviceId: string }).deviceId,
        { message: JSON.stringify(relocation), deliveredAt: null },
      ]),
    );
    await tx
      .update(cloudMove)
      .set({
        status: "moved",
        importId: input.importId,
        relocations,
        completedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(cloudMove.id, input.moveId));
    return { registers: input.relocations.length };
  },
  audit: (input, output) => ({ importId: input.importId, registers: output.registers }),
});

/** A move that failed for good: the box takes changes again, and the owner sees why. */
export const failCloudMove = defineCommand({
  name: "migration.move.fail",
  async run(tx, _ctx, input: { moveId: string; reason: string }) {
    await tx
      .update(cloudMove)
      .set({ status: "failed", error: input.reason, updatedAt: sql`now()` })
      .where(eq(cloudMove.id, input.moveId));
    return { moveId: input.moveId };
  },
  audit: (input) => ({ reason: input.reason }),
});

/** A register's handshake handed it its relocation: recorded once, for the move screen. */
export const deliverRelocation = defineCommand({
  name: "migration.move.deliver",
  async run(tx, _ctx, input: { moveId: string; deviceId: string }) {
    await tx
      .update(cloudMove)
      .set({
        relocations: sql`jsonb_set(${cloudMove.relocations}, ${`{${input.deviceId},deliveredAt}`}::text[], to_jsonb(now()::text))`,
        updatedAt: sql`now()`,
      })
      .where(eq(cloudMove.id, input.moveId));
    return { deviceId: input.deviceId };
  },
  audit: (input) => ({ deviceId: input.deviceId }),
});
