import { and, eq, ne, sql } from "drizzle-orm";
import type { Licence } from "@shopper/core/licence";
import {
  archiveImport,
  auditLog,
  type MoveCredentials,
  type RelocationCode,
  type ShopperDatabase,
} from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { ImportError } from "../import/error";
import { importArchive } from "../import/run";
import { reconciliationReport } from "../reconcile/report";
import type { compareReports } from "../reconcile/compare";
import { verifyArchive } from "../verify";
import { readZip } from "../zip";
import type { ArrivalDeps } from "../types";

/**
 * A box takes over a cloud shop from the archive it was installed with: the file is checked on its own, then it must be
 * the move's (the cloud compares its manifest), and the licence must be the shop's. The claim hands over the
 * credentials and the registers' codes; the import writes the shop in one transaction; the report of what arrived goes
 * back, and the cloud's comparison is the answer. A box cut off mid-way runs this again: the claim issues fresh codes
 * and an import that already landed is a no-op.
 */
export async function arriveFromCloud(
  db: ShopperDatabase,
  deps: ArrivalDeps,
  input: { archive: Uint8Array; licence: Licence; upstream: string },
) {
  const verified = await verifyArchive(input.archive);
  if (!verified.ok) throw new ImportError(verified.message, 422);
  const manifest = verified.manifest;
  const orgId = manifest.org.id;
  if (input.licence.org !== orgId)
    throw new ImportError("This licence was issued for another shop.", 422);
  const files = readZip(input.archive);
  const claimed = await ask<{
    credentials: MoveCredentials;
    codes?: Record<string, RelocationCode>;
  }>(
    await deps.cloud("/migration/handover/claim", {
      upstream: input.upstream,
      manifestSha256: await sha256(files.get("manifest.json")!),
    }),
  );
  // Recorded before the import, so the codes are redeemable the moment the shop is in.
  const [arrival] = await db
    .insert(archiveImport)
    .values({
      orgId,
      status: "importing",
      licenceId: input.licence.id,
      manifest,
      signature: new TextDecoder().decode(files.get("manifest.sig")),
      relocations: claimed.codes ?? {},
    })
    .onConflictDoUpdate({
      target: archiveImport.orgId,
      // A move the cloud already verified hands no new codes: the ones recorded first stand.
      set: { ...(claimed.codes && { relocations: claimed.codes }), updatedAt: sql`now()` },
    })
    .returning({ id: archiveImport.id });
  await importArchive(
    db,
    { orgId, appVersion: deps.appVersion },
    {
      manifest,
      read: async (path) => files.get(path),
      blobs: deps.blobs,
      credentials: claimed.credentials,
      source: { importId: arrival!.id, licenceId: input.licence.id },
    },
  );
  const [last] = await db
    .select({ seq: sql<number>`max(${auditLog.chainSeq})::int` })
    .from(auditLog)
    .where(and(eq(auditLog.orgId, orgId), ne(auditLog.command, "migration.import")));
  const report = await reconciliationReport(db, orgId, { auditUpTo: last?.seq ?? 0 });
  const result = await ask<ReturnType<typeof compareReports>>(
    await deps.cloud("/migration/handover/report", { report }),
  );
  // A report that disagrees is kept, and the import stays pending: the owner can run it again.
  await db
    .update(archiveImport)
    .set({
      report: result,
      ...(result.ok && { status: "ready" as const, completedAt: sql`now()` }),
      updatedAt: sql`now()`,
    })
    .where(eq(archiveImport.id, arrival!.id));
  return { shop: manifest.org.name, ...result };
}

/** The cloud's answer; its refusal, in its own words, is the owner's (anything else: it could not be reached). */
async function ask<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (response.ok) return body as T;
  const status = [403, 409, 422].includes(response.status) ? response.status : 502;
  throw new ImportError(
    body.error ?? `The cloud answered ${response.status}.`,
    status as 403 | 409 | 422 | 502,
  );
}
