import { eq } from "drizzle-orm";
import { boxArchiveExport, boxCache, boxSequencer } from "@shopper/adapters-box";
import { createApi, type ApiAuthentication } from "@shopper/api";
import { createDeviceService } from "@shopper/auth/devices";
import { generateKey, issueLicence, signedRequest, type Licence } from "@shopper/core/licence";
import * as schema from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { exportFixture } from "../export/org";
import { diskBlobs, emptyDatabase } from "./archive";

/** The cloud's API origin, and the box's address on the shop's LAN as its registers will reach it. */
export const CLOUD = "https://cloud.shopper.test";
export const BOX = "https://shopper.local";

/**
 * A trading cloud shop (the export fixture's org with two enrolled registers) and an empty box database, in-process.
 * Members are signed in by header: `owner` holds every permission, `cashier` holds none of the move's.
 */
export async function cloudAndBox() {
  const f = await exportFixture();
  const storage = await diskBlobs();
  const b = await emptyDatabase();
  const issuer = await generateKey();
  const caches = [boxCache(":memory:"), boxCache(":memory:")];
  const exports = boxArchiveExport({ database: f.db, blobs: storage.blobs });
  const [owner] = await f.db.select().from(schema.user).where(eq(schema.user.id, f.userId));
  const people = {
    owner: { orgId: f.ctx.orgId, userId: owner!.id, roleId: owner!.id, roleName: "owner" },
    cashier: { orgId: f.ctx.orgId, userId: owner!.id, roleId: owner!.id, roleName: "cashier" },
  };
  const authentication: ApiAuthentication = {
    resolvePrincipal: async (request) =>
      people[request.headers.get("x-member") as keyof typeof people] ?? null,
    hasPermission: async (principal) => principal.roleName === "owner",
  };
  const cloud = createApi({
    database: f.db,
    blobs: storage.blobs,
    authentication,
    licenceSigningKey: issuer.privateKey,
    archiveExports: exports.launcher,
    devices: createDeviceService(f.db, caches[0]!.cache, f.ctx.appVersion),
    sequencer: boxSequencer(f.db),
  });
  const box = createApi({
    database: b.db,
    devices: createDeviceService(b.db, caches[1]!.cache, f.ctx.appVersion),
    sequencer: boxSequencer(b.db),
  });
  const [first] = await f.db
    .select()
    .from(schema.device)
    .where(eq(schema.device.id, f.sale.deviceId));
  const [second] = await f.db
    .insert(schema.device)
    .values({ orgId: f.ctx.orgId, branchId: first!.branchId, name: "Till 2" })
    .returning();
  const registers = await Promise.all(
    [first!, second!].map(async (register, index) => {
      const token = String(index + 1).repeat(64);
      await f.db
        .insert(schema.deviceCredential)
        .values({ orgId: f.ctx.orgId, deviceId: register.id, tokenHash: await sha256(token) })
        .onConflictDoUpdate({
          target: [schema.deviceCredential.orgId, schema.deviceCredential.deviceId],
          set: { tokenHash: await sha256(token), revokedAt: null },
        });
      return { ...register, token };
    }),
  );
  return {
    f,
    b,
    issuer,
    cloud,
    box,
    blobs: storage.blobs,
    registers,
    /** A member's call to the cloud portal API. */
    member: (as: "owner" | "cashier", method: string, path: string, body?: unknown) =>
      cloud.request(path, {
        method,
        headers: { "x-member": as, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    /** The cloud's archive workflow runs to the end. */
    sealed: () => exports.launcher.idle?.(),
    /** A box's licence-signed call to the cloud. */
    signed: async (identity: { key: string; licence: Licence }, path: string, body: unknown) =>
      cloud.fetch(
        await signedRequest(identity, `${CLOUD}${path}`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      ),
    close: async () => {
      for (const cache of caches) cache.close();
      await f.close();
      await storage.remove();
      await b.close();
    },
  };
}

/** A box's own key and the request code its first-boot wizard shows for it. */
export async function boxIdentity(machine = "b".repeat(64)) {
  const key = await generateKey();
  const request = Buffer.from(JSON.stringify({ machine, key: key.publicKey })).toString(
    "base64url",
  );
  return { key, request, machine };
}

/** A genuine licence for `org` that is not the one a move issued. */
export async function strayLicence(issuerKey: string, org: string, publicKey: string) {
  return issueLicence(issuerKey, {
    id: crypto.randomUUID(),
    org,
    site: "Elsewhere",
    machine: "c".repeat(64),
    key: publicKey,
    terminals: 5,
    issuedAt: new Date().toISOString(),
    maintenanceUntil: "2027-11-17",
  });
}
