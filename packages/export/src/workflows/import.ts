import { eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { archiveImport } from "@shopper/db-pg";
import type { Workflow } from "@shopper/ports";
import { importArchive } from "../import/run";
import { archiveImportId } from "../move/commit";
import { importKey } from "../move/uploads";
import { archiveImportParams } from "../schemas/move";
import type { Manifest } from "../schemas/manifest";
import type { ArchiveExportDeps } from "../types";

const policy = { maxAttempts: 3, delayMs: 2000, backoff: "exponential" } as const;

/**
 * A committed import: the whole archive in one transaction (a retry after a failure starts clean, a retry after
 * success is the import's own no-op), then the import marked ready and its credentials forgotten. A failure for good
 * is recorded, credentials forgotten too, so the box can show it and send them again.
 * ponytail: one transaction in one step fits a pilot shop; per-table steps if one outgrows a step's budget.
 */
export async function runArchiveImport(
  flow: Pick<Workflow, "instanceId" | "step">,
  deps: ArchiveExportDeps,
  raw: unknown,
) {
  const params = v.parse(archiveImportParams, raw);
  if (flow.instanceId !== archiveImportId(params.importId))
    throw new Error("Archive import instance must be its import key");
  try {
    await flow.step("import", policy, () =>
      deps.withDatabase(async (db) => {
        const [row] = await db
          .select()
          .from(archiveImport)
          .where(eq(archiveImport.id, params.importId));
        if (!row || row.status === "ready") return { imported: false };
        const output = await importArchive(
          db,
          { orgId: params.orgId, appVersion: deps.appVersion },
          {
            manifest: row.manifest as Manifest,
            read: async (path) =>
              (await deps.blobs.get(params.orgId, importKey(path))) ?? undefined,
            blobs: deps.blobs,
            credentials: row.credentials,
            source: { importId: row.id, licenceId: row.licenceId },
          },
        );
        await db
          .update(archiveImport)
          .set({
            status: "ready",
            credentials: null,
            completedAt: sql`now()`,
            updatedAt: sql`now()`,
          })
          .where(eq(archiveImport.id, row.id));
        return { imported: output.imported };
      }),
    );
  } catch (error) {
    await flow.step("fail", policy, () =>
      deps.withDatabase(async (db) => {
        await db
          .update(archiveImport)
          .set({
            status: "failed",
            credentials: null,
            error: error instanceof Error ? error.message : String(error),
            updatedAt: sql`now()`,
          })
          .where(eq(archiveImport.id, params.importId));
        return { failed: true };
      }),
    );
    throw error;
  }
}
