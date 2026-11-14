import { and, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import {
  archiveImport,
  branch,
  device,
  deviceCredential,
  type ShopperDatabase,
} from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { relocationInput } from "../schemas/devices";
import { DeviceError, randomToken } from "./commands";

/**
 * A register that moved with its shop claims its place in the cloud: the one-time code from its signed relocation
 * buys a new token for the same device id, so its receipt blocks, sales and sequence carry on. Until the import is in,
 * the register is told to wait.
 */
export async function relocateDevice(db: ShopperDatabase, appVersion: string, input: unknown) {
  const data = v.parse(relocationInput, input);
  const [moving] = await db
    .select({ status: archiveImport.status })
    .from(archiveImport)
    .where(eq(archiveImport.orgId, data.orgId));
  if (!moving) throw new DeviceError("Invalid relocation");
  if (moving.status !== "ready")
    throw new DeviceError("This shop is still moving to the cloud. Try again shortly.", 409);
  return claim(db, { orgId: data.orgId, deviceId: data.deviceId, appVersion }, data);
}

const claim = defineCommand({
  name: "device.relocate",
  async run(tx, c, input: v.InferOutput<typeof relocationInput>) {
    const now = new Date();
    // Locked so two claims with the same code cannot both pass.
    const [row] = await tx
      .select({ id: archiveImport.id, relocations: archiveImport.relocations })
      .from(archiveImport)
      .where(eq(archiveImport.orgId, c.orgId))
      .for("update");
    const code = row?.relocations[input.deviceId];
    if (
      !row ||
      !code ||
      code.usedAt ||
      Date.parse(code.expiresAt) <= now.getTime() ||
      code.codeHash !== (await sha256(input.code))
    )
      throw new DeviceError("Invalid or expired relocation code");
    await tx
      .update(archiveImport)
      .set({
        relocations: sql`jsonb_set(${archiveImport.relocations}, ${`{${input.deviceId},usedAt}`}::text[], to_jsonb(${now.toISOString()}::text))`,
      })
      .where(eq(archiveImport.id, row.id));
    const [found] = await tx
      .select({
        device,
        storeId: branch.storeId,
        branchName: branch.name,
        branchCode: branch.code,
      })
      .from(device)
      .innerJoin(branch, and(eq(branch.orgId, device.orgId), eq(branch.id, device.branchId)))
      .where(and(eq(device.orgId, c.orgId), eq(device.id, input.deviceId)));
    if (!found) throw new DeviceError("Invalid or expired relocation code");
    const deviceToken = randomToken();
    await tx
      .insert(deviceCredential)
      .values({ orgId: c.orgId, deviceId: input.deviceId, tokenHash: await sha256(deviceToken) })
      .onConflictDoUpdate({
        target: [deviceCredential.orgId, deviceCredential.deviceId],
        set: { tokenHash: await sha256(deviceToken), revokedAt: null },
      });
    return {
      deviceId: found.device.id,
      branchId: found.device.branchId,
      storeId: found.storeId,
      branchName: found.branchName,
      deviceToken,
      receiptCodes: { branchCode: found.branchCode, deviceCode: found.device.code },
    };
  },
  audit: (_input, result) => ({ deviceId: result.deviceId, branchId: result.branchId }),
});
