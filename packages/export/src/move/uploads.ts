import { and, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { verify, type Licence } from "@shopper/core/licence";
import { archiveImport, org, type ShopperDatabase } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { ImportError } from "../import/error";
import { manifest as manifestSchema, type Manifest } from "../schemas/manifest";

/** Where an import's files wait in the org's blobs: one import per org at a time, so no id in the key. */
export const importKey = (path: string) => `imports/${path}`;

/**
 * A licensed box opens (or reopens) the import of its own shop. A second open finds the same import and says which
 * files are still missing, so a box that restarts mid-upload sends only those; a failed import starts a new attempt
 * that keeps the files already checked.
 */
export async function openImport(
  db: ShopperDatabase,
  licence: Licence,
  body: { manifest: string; signature: string },
) {
  const parsed = v.safeParse(manifestSchema, parseJson(body.manifest));
  if (!parsed.success) throw new ImportError("This is not a Shopper Archive manifest.");
  const manifest = parsed.output;
  if (!(await verify(manifest.public_key, body.manifest, body.signature)))
    throw new ImportError("This archive's signature does not match its manifest.");
  // The trust decision Day 41 left to the importer: the licence the issuer signed names the shop the archive is of.
  if (manifest.org.id !== licence.org)
    throw new ImportError("This archive is another shop's.", 403);
  const [existing] = await db.select({ id: org.id }).from(org).where(eq(org.id, licence.org));
  if (existing) throw new ImportError("This shop is already in the cloud.", 409);
  const [row] = await db
    .insert(archiveImport)
    .values({ orgId: licence.org, licenceId: licence.id, manifest, signature: body.signature })
    .onConflictDoUpdate({
      target: archiveImport.orgId,
      // A resealed archive is another set of files: what arrived for the old one no longer counts.
      set: {
        id: sql`case when ${archiveImport.status} = 'failed' then uuidv7() else ${archiveImport.id} end`,
        status: sql`case when ${archiveImport.status} = 'failed' then 'uploading' else ${archiveImport.status} end`,
        received: sql`case when ${archiveImport.signature} = excluded.signature then ${archiveImport.received} else '[]'::jsonb end`,
        manifest: sql`excluded.manifest`,
        signature: sql`excluded.signature`,
        licenceId: sql`excluded.licence_id`,
        error: null,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return describe(row!);
}

/** One archive file from the box, kept only when it is exactly the file the manifest signed. */
export async function receiveFile(
  db: ShopperDatabase,
  blobs: Blobs,
  input: { orgId: string; importId: string; path: string; bytes: Uint8Array },
) {
  const row = await findImport(db, input.orgId, input.importId);
  if (row.status !== "uploading") throw new ImportError("This import is no longer uploading.", 409);
  const file = listed(row.manifest as Manifest).find((each) => each.path === input.path);
  if (!file) throw new ImportError(`${input.path} is not in this archive.`, 404);
  if (input.bytes.length !== file.bytes || (await sha256(input.bytes)) !== file.sha256)
    throw new ImportError(`${input.path} is not the file the archive signed.`);
  await blobs.put(input.orgId, importKey(input.path), input.bytes);
  await db
    .update(archiveImport)
    .set({
      received: sql`case when ${archiveImport.received} ? ${input.path} then ${archiveImport.received}
        else ${archiveImport.received} || to_jsonb(${input.path}::text) end`,
      updatedAt: sql`now()`,
    })
    .where(eq(archiveImport.id, row.id));
}

export async function getImport(db: ShopperDatabase, orgId: string, importId: string) {
  return describe(await findImport(db, orgId, importId));
}

export async function findImport(db: ShopperDatabase, orgId: string, importId: string) {
  const [row] = await db
    .select()
    .from(archiveImport)
    .where(and(eq(archiveImport.orgId, orgId), eq(archiveImport.id, importId)));
  if (!row) throw new ImportError("No such import.", 404);
  return row;
}

/** Every file the manifest lists: table parts, then blobs. */
export const listed = (manifest: Manifest) => [
  ...Object.values(manifest.tables).flatMap((table) => table.files),
  ...manifest.blobs,
];

function describe(row: typeof archiveImport.$inferSelect) {
  const received = new Set(row.received);
  return {
    id: row.id,
    status: row.status,
    missing: listed(row.manifest as Manifest)
      .map((file) => file.path)
      .filter((path) => !received.has(path)),
    error: row.error,
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
