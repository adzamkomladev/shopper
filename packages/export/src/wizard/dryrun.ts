import type { ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import { archiveEntries } from "../archive/download";
import { getArchiveExport } from "../archive/read";
import { verifyParts } from "../verify";
import { cutoverMinutes } from "./preflight";

/**
 * A dry run's verdict: the sealed archive read back exactly as a box or the cloud will read it (signature, every part's
 * size, digest and row count), one part at a time so a large shop fits a Worker's memory, with what it holds and how long the move would keep the shop frozen. Undefined when
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
  // Part by part, as the archive would be read: a part that is gone is a failed dry run, not an error.
  const entries = new Map(
    (await archiveEntries(blobs, input.orgId, input.id)).map((entry) => [entry.path, entry]),
  );
  const verdict = await verifyParts([...entries.keys()], async (path) =>
    entries
      .get(path)
      ?.read()
      .catch(() => undefined),
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
