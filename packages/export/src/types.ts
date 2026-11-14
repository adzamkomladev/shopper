import type { SQL } from "drizzle-orm";
import type { ReportCell } from "@shopper/core/reports";
import type { MoveCredentials, ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import type { Manifest } from "./schemas/manifest";

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

/** What the export workflow needs from its runtime: a connection per step, the org's blobs, the build's version. */
export type ArchiveExportDeps = {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  blobs: Blobs;
  appVersion: string;
  now?: () => Date;
};

/**
 * One entity's spreadsheet as a query: `from` names the base table as `t` (its org and id are the paging key) and
 * joins whatever the columns show. `day` is the Accra date a ranged entity is cut by.
 */
export type EntityDefinition = {
  from: SQL;
  columns: { header: string; kind: ReportCell["kind"]; sql: SQL }[];
  day?: SQL;
  /** False for a query that is not one row per `t.id` (a sum): it is read once, ordered by `order`. */
  paged?: boolean;
  order?: SQL;
};

/** Accra calendar days, first to last, inclusive. */
export type DayRange = { from: string; to: string };

/** What an import reads: the manifest, each file by its path, where blobs go, and a move's credentials. */
export type ImportInput = {
  manifest: Manifest;
  /** The bytes of one archive file by its path, or undefined when it never arrived. */
  read: (path: string) => Promise<Uint8Array | undefined>;
  blobs: Blobs;
  credentials?: MoveCredentials | null;
  /** The cloud import this run belongs to, named in its audit row (the org has no audit chain before it). */
  source?: { importId: string; licenceId: string };
};

/** A box moving to the cloud: the export's needs, plus a licence-signed request to the cloud. */
export type CloudMoveDeps = ArchiveExportDeps & {
  cloud(url: string, init: { method: string; body?: string | Uint8Array }): Promise<Response>;
};
