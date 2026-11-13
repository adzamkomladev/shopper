import { and, desc, eq, ne } from "drizzle-orm";
import { archiveKey, exportJob, user, type ShopperDatabase } from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";

const columns = {
  id: exportJob.id,
  status: exportJob.status,
  requestedBy: user.name,
  createdAt: exportJob.createdAt,
  completedAt: exportJob.completedAt,
  files: exportJob.files,
  rows: exportJob.rows,
  bytes: exportJob.bytes,
  missingBlobs: exportJob.missingBlobs,
  error: exportJob.error,
};
const joined = (db: ShopperDatabase) =>
  db
    .select(columns)
    .from(exportJob)
    .leftJoin(user, and(eq(user.orgId, exportJob.orgId), eq(user.id, exportJob.requestedBy)));

/** The org's archives, newest first, with the fingerprint of the key they are signed with. */
export async function listArchiveExports(db: ShopperDatabase, orgId: string) {
  const archives = await joined(db)
    .where(and(eq(exportJob.orgId, orgId), ne(exportJob.status, "deleted")))
    .orderBy(desc(exportJob.id))
    .limit(50);
  const [key] = await db.select().from(archiveKey).where(eq(archiveKey.orgId, orgId));
  const digest = key ? await sha256(key.publicKey) : undefined;
  return {
    archives,
    // Four-character groups of the key's SHA-256, for an owner to compare against the manifest's key.
    fingerprint: digest?.slice(0, 16).toUpperCase().match(/.{4}/g)?.join("-") ?? null,
  };
}

export async function getArchiveExport(db: ShopperDatabase, orgId: string, id: string) {
  const [job] = await joined(db).where(and(eq(exportJob.orgId, orgId), eq(exportJob.id, id)));
  return job && job.status !== "deleted" ? job : undefined;
}
