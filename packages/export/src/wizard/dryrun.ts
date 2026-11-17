import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import { archiveEntries } from "../archive/download";
import { getArchiveExport } from "../archive/read";
import { verifyArchive } from "../verify";
import { zipBytes } from "../zip";
import { cutoverMinutes } from "./preflight";

/**
 * A dry run's verdict: the sealed archive read back exactly as a box or the cloud will read it (signature, every part's
 * size, digest and row count), with what it holds and how long the move would keep the shop frozen. Undefined when
 * the org has no such archive.
 */
export async function dryRunResult(
  db: ShopperDatabase,
  blobs: Blobs,
  input: { orgId: string; id: string },
) {
  const job = await getArchiveExport(db, input.orgId, input.id);
  if (!job) return undefined;
  if (job.status !== "ready") return { status: job.status };
  // A part that is gone or no longer its listed size stops the zip itself: that is a failed dry run, not an error.
  const verdict = await zipBytes(await archiveEntries(blobs, input.orgId, input.id)).then(
    verifyArchive,
    (error: unknown) => ({ ok: false, message: (error as Error).message }) as const,
  );
  return {
    status: job.status,
    verified: verdict.ok,
    message: verdict.ok ? null : verdict.message,
    tables: verdict.ok ? Object.keys(verdict.manifest.tables).length : 0,
    rows: job.rows,
    files: job.files,
    bytes: job.bytes,
    minutes: cutoverMinutes(job.bytes),
  };
}
