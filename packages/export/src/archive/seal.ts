import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { generateKey } from "@shopper/core/licence";
import { archiveKey, exportJob, org } from "@shopper/db-pg";
import type { Blobs } from "@shopper/ports";
import { buildInfo } from "@shopper/config";
import { sha256 } from "@shopper/utils";
import { buildManifest, describeFile, signManifest } from "../manifest";
import { archiveEntryList, dumpResult } from "../schemas/archive";
import * as v from "valibot";
import { zipLength } from "../zip";
import { exportPrefix } from "./ids";

const encoder = new TextEncoder();

/**
 * Seals the dumped parts: signs a manifest of every part with the org's key, writes `manifest.json`, `manifest.sig`
 * and the list of entries the ZIP is assembled from, and marks the archive ready with its exact size.
 */
export const sealArchiveExport = defineCommand({
  name: "export.archive.seal",
  async run(tx, ctx, input: { jobId: string; blobs: Blobs; at: string }) {
    const prefix = exportPrefix(input.jobId);
    const dumped = v.parse(
      dumpResult,
      JSON.parse(
        new TextDecoder().decode((await input.blobs.get(ctx.orgId, `${prefix}/files.json`))!),
      ),
    );
    const key = await keyFor(tx, ctx.orgId);
    const [business] = await tx.select().from(org).where(eq(org.id, ctx.orgId));
    const manifest = buildManifest(
      {
        productVersion: ctx.appVersion,
        schemaVersion: buildInfo.schemaVersion,
        createdAt: input.at,
        publicKey: key.publicKey,
        org: { id: business!.id, name: business!.name, slug: business!.slug },
      },
      dumped.files,
    );
    const signed = await signManifest(manifest, key.privateKey);
    const signature = encoder.encode(signed.signature);
    const sealed = await Promise.all(
      (
        [
          ["manifest.json", signed.json],
          ["manifest.sig", signature],
        ] as const
      ).map(async ([path, bytes]) => {
        await input.blobs.put(ctx.orgId, `${prefix}/${path}`, bytes);
        return { ...(await describeFile(path, bytes)), key: `${prefix}/${path}` };
      }),
    );
    const entries = [...dumped.files, ...sealed];
    await input.blobs.put(
      ctx.orgId,
      `${prefix}/entries.json`,
      encoder.encode(JSON.stringify(v.parse(archiveEntryList, { entries }))),
    );
    const output = {
      jobId: input.jobId,
      files: dumped.files.length,
      rows: dumped.files.reduce((sum, file) => sum + file.rows, 0),
      bytes: zipLength(entries.map((entry) => ({ ...entry, read: async () => signature }))),
      manifestSha256: await sha256(signed.json),
      publicKey: key.publicKey,
      missingBlobs: dumped.missingBlobs.length,
    };
    await tx
      .update(exportJob)
      .set({
        status: "ready",
        files: output.files,
        rows: output.rows,
        bytes: output.bytes,
        manifestSha256: output.manifestSha256,
        missingBlobs: output.missingBlobs,
        completedAt: new Date(input.at),
        updatedAt: new Date(input.at),
      })
      .where(eq(exportJob.id, input.jobId));
    return output;
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "export_job", entityId: output.jobId }),
});

/** The org's signing key, made at its first archive. The command's org lock makes two first archives agree. */
async function keyFor(
  tx: Parameters<Parameters<typeof defineCommand>[0]["run"]>[0],
  orgId: string,
) {
  const fresh = await generateKey();
  await tx
    .insert(archiveKey)
    .values({ orgId, privateKey: fresh.privateKey, publicKey: fresh.publicKey })
    .onConflictDoNothing();
  const [row] = await tx.select().from(archiveKey).where(eq(archiveKey.orgId, orgId));
  return row!;
}
