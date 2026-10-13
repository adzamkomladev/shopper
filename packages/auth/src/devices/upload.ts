import { and, eq, isNull } from "drizzle-orm";
import * as v from "valibot";
import { branch, device, deviceCredential, type ShopperDatabase } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { digest } from "./commands";

export async function resolveUploadPrincipal(
  db: ShopperDatabase,
  request: Request,
  orgId?: string,
) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  const id = v.safeParse(uuidV7Schema, request.headers.get("x-shopper-device"));
  if (!token || !id.success) return null;
  const [row] = await db
    .select({
      orgId: device.orgId,
      deviceId: device.id,
      branchId: device.branchId,
      storeId: branch.storeId,
    })
    .from(deviceCredential)
    .innerJoin(
      device,
      and(eq(device.orgId, deviceCredential.orgId), eq(device.id, deviceCredential.deviceId)),
    )
    .innerJoin(branch, and(eq(branch.orgId, device.orgId), eq(branch.id, device.branchId)))
    .where(
      and(
        eq(device.id, id.output),
        eq(deviceCredential.tokenHash, await digest(token)),
        isNull(deviceCredential.revokedAt),
      ),
    );
  if (!row || (orgId && row.orgId !== orgId.toLowerCase())) return null;
  for (const [header, expected] of [
    ["x-shopper-org", row.orgId],
    ["x-shopper-store", row.storeId],
    ["x-shopper-branch", row.branchId],
  ] as const) {
    const selected = request.headers.get(header);
    if (selected && selected.toLowerCase() !== expected) return null;
  }
  return row;
}
