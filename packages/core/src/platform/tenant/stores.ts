import { asc, eq, sql } from "drizzle-orm";
import { branch, device, deviceCredential, store, type ShopperDatabase } from "@shopper/db-pg";

/**
 * Each store with its branches and their registers. A register's last sighting is its newest cashier sign-in or
 * audit upload, whichever is later; one never seen has none.
 */
export async function tenantStores(db: ShopperDatabase, orgId: string) {
  const [stores, branches, devices] = await Promise.all([
    db
      .select({ id: store.id, name: store.name, opensAt: store.opensAt, closesAt: store.closesAt })
      .from(store)
      .where(eq(store.orgId, orgId))
      .orderBy(asc(store.createdAt)),
    db
      .select({ id: branch.id, storeId: branch.storeId, name: branch.name, code: branch.code })
      .from(branch)
      .where(eq(branch.orgId, orgId))
      .orderBy(asc(branch.createdAt)),
    db
      .select({
        id: device.id,
        branchId: device.branchId,
        name: device.name,
        code: device.code,
        createdAt: device.createdAt,
        revokedAt: deviceCredential.revokedAt,
        lastSeenAt: sql<Date | string | null>`greatest(
          (select max(s.issued_at) from cashier_session s where s.org_id = ${device.orgId} and s.device_id = ${device.id}),
          (select max(a.created_at) from device_audit a where a.org_id = ${device.orgId} and a.stream_id = ${device.id})
        )`,
      })
      .from(device)
      .leftJoin(deviceCredential, eq(deviceCredential.deviceId, device.id))
      .where(eq(device.orgId, orgId))
      .orderBy(asc(device.createdAt)),
  ]);
  return stores.map((each) => ({
    ...each,
    branches: branches
      .filter((row) => row.storeId === each.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        devices: devices
          .filter((register) => register.branchId === row.id)
          .map((register) => ({
            id: register.id,
            name: register.name,
            code: register.code,
            createdAt: register.createdAt.toISOString(),
            revoked: Boolean(register.revokedAt),
            // The driver hands back a Date or a string depending on the runtime.
            lastSeenAt: register.lastSeenAt ? new Date(register.lastSeenAt).toISOString() : null,
          })),
      })),
  }));
}
