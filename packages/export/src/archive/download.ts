import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import type { Blobs } from "@shopper/ports";
import { archiveEntryList } from "../schemas/archive";
import type { ZipEntry } from "../types";
import { MAX_BLOB_BYTES } from "../dump/tables";
import { ExportError } from "./error";
import { exportPrefix } from "./ids";

/** Records that an owner took a copy. The file itself is streamed by the API from `archiveEntries`. */
export const recordArchiveDownload = defineCommand({
  name: "export.archive.download",
  async run(_tx, _ctx, input: { jobId: string }) {
    return { jobId: input.jobId };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "export_job", entityId: output.jobId }),
});

/** The ZIP's entries, each reading its bytes from storage only when the stream reaches it. */
export async function archiveEntries(
  blobs: Blobs,
  orgId: string,
  jobId: string,
): Promise<ZipEntry[]> {
  return (await readEntries(blobs, orgId, jobId)).map((entry) => ({
    path: entry.path,
    bytes: entry.bytes,
    crc: entry.crc,
    read: async () => {
      const bytes = await blobs.get(orgId, entry.key, MAX_BLOB_BYTES);
      if (!bytes) throw new ExportError("not_found", `${entry.path} is no longer stored.`);
      return bytes;
    },
  }));
}

export async function readEntries(blobs: Blobs, orgId: string, jobId: string) {
  const listed = await blobs.get(orgId, `${exportPrefix(jobId)}/entries.json`);
  if (!listed) throw new ExportError("not_ready", "This archive is not ready.");
  return v.parse(archiveEntryList, JSON.parse(new TextDecoder().decode(listed))).entries;
}
