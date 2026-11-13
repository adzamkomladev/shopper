import type { Blobs } from "@shopper/ports";

/** A file to write into a ZIP: `bytes` and `crc` were measured when it was made, `read` gives it back on demand. */
export type ZipEntry = {
  path: string;
  bytes: number;
  crc: number;
  read: () => Promise<Uint8Array>;
};

/** One file of an archive as measured when it was written, so nothing has to hold the archive to describe it. */
export type FileDescription = {
  path: string;
  bytes: number;
  sha256: string;
  crc: number;
  rows: number;
};

/** A described file plus the blob key its bytes can be read from: a written part, or the original blob. */
export type DumpFile = FileDescription & { key: string };

export type DumpOptions = {
  orgId: string;
  blobs: Blobs;
  /** Where the table pages are written in the org's blobs. */
  prefix: string;
  pageRows?: number;
  /** Runs after each table is read; a test uses it to play the shop trading while the dump runs. */
  afterTable?: (table: string) => Promise<void>;
};

export type DumpResult = { files: DumpFile[]; missingBlobs: string[] };
