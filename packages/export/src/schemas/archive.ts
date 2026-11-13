import * as v from "valibot";

const id = v.pipe(v.string(), v.uuid());
const count = v.pipe(v.number(), v.integer(), v.minValue(0));
const file = v.object({
  path: v.string(),
  bytes: count,
  sha256: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/)),
  crc: count,
  rows: count,
  key: v.string(),
});

export const archiveExportParams = v.object({ orgId: id, jobId: id });

/** `files.json` and `entries.json` beside an export's parts: what the dump wrote, then what the ZIP will hold. */
export const dumpResult = v.object({ files: v.array(file), missingBlobs: v.array(v.string()) });
export const archiveEntryList = v.object({ entries: v.array(file) });
