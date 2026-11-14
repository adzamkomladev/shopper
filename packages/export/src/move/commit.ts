import { eq, sql } from "drizzle-orm";
import { signRelocation, toBase64Url } from "@shopper/core/licence";
import {
  archiveImport,
  type MoveCredentials,
  type RelocationCode,
  type ShopperDatabase,
} from "@shopper/db-pg";
import type { Blobs, WorkflowLauncher } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { ImportError } from "../import/error";
import type { Manifest } from "../schemas/manifest";
import { findImport, importKey, listed } from "./uploads";

/** How long a register has to claim its place in the cloud before it is re-enrolled by hand. */
const RELOCATION_DAYS = 7;

/** The workflow's business key: one import per org at a time, each attempt with its own id. */
export const archiveImportId = (importId: string) => `archive-import_${importId}`;

/**
 * Once every file has arrived: the credentials are held for the import, the import starts, and every register of the
 * shop gets a relocation signed by the issuer with a fresh one-time code. Committing again (the box lost the answer)
 * issues fresh codes; the old ones stop working.
 */
export async function commitImport(
  db: ShopperDatabase,
  deps: { blobs: Blobs; launcher: WorkflowLauncher; issuerKey: string },
  input: {
    orgId: string;
    importId: string;
    upstream: string;
    credentials?: MoveCredentials;
    now?: Date;
  },
) {
  const row = await findImport(db, input.orgId, input.importId);
  const manifest = row.manifest as Manifest;
  if (row.status === "uploading") {
    const received = new Set(row.received);
    const missing = listed(manifest)
      .map((file) => file.path)
      .filter((path) => !received.has(path));
    if (missing.length) throw new ImportError("Some files have not arrived.", 409, missing);
  }
  if (row.status === "failed")
    throw new ImportError("This import failed. Open it again to retry.", 409);
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + RELOCATION_DAYS * 86_400_000).toISOString();
  const issued = await Promise.all(
    (await registers(deps.blobs, input.orgId, manifest)).map(async (deviceId) => {
      const code = toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
      return {
        deviceId,
        stored: { codeHash: await sha256(code), expiresAt, usedAt: null } as RelocationCode,
        relocation: await signRelocation(deps.issuerKey, {
          orgId: input.orgId,
          deviceId,
          upstream: input.upstream,
          code,
          expiresAt,
        }),
      };
    }),
  );
  const starting = row.status === "uploading";
  await db
    .update(archiveImport)
    .set({
      relocations: Object.fromEntries(issued.map((each) => [each.deviceId, each.stored])),
      ...(starting ? { status: "importing" as const, credentials: input.credentials ?? null } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(archiveImport.id, row.id));
  if (starting)
    await deps.launcher.start(archiveImportId(row.id), {
      orgId: input.orgId,
      importId: row.id,
    });
  return {
    status: starting ? "importing" : row.status,
    relocations: issued.map((each) => each.relocation),
  };
}

/** The shop's registers, read from the archive's own device rows. */
async function registers(blobs: Blobs, orgId: string, manifest: Manifest) {
  const files = manifest.tables.device?.files ?? [];
  const parts = await Promise.all(files.map((file) => blobs.get(orgId, importKey(file.path))));
  return parts.flatMap((bytes) =>
    new TextDecoder()
      .decode(bytes ?? new Uint8Array())
      .split("\n")
      .filter(Boolean)
      .map((line) => (JSON.parse(line) as { id: string }).id),
  );
}
