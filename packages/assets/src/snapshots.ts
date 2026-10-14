import { and, eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { asset } from "@shopper/db-pg";
import { scopedKey, type Blobs } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { assetPolicy } from "./schemas/policy";

export const saveSnapshotAsset = defineCommand({
  name: "asset.snapshot.save",
  async replay(tx, context, input: { blobs: Blobs; key: string; bytes: Uint8Array }) {
    const [saved] = await tx
      .select()
      .from(asset)
      .where(and(eq(asset.orgId, context.orgId), eq(asset.key, input.key)));
    return saved && (await input.blobs.get(context.orgId, input.key))
      ? { output: { id: saved.id } }
      : undefined;
  },
  async run(tx, context, input) {
    scopedKey(context.orgId, input.key);
    if (!input.key.startsWith("snapshots/")) throw new Error("Snapshots require a snapshots key");
    const policy = assetPolicy.sync_snapshot;
    const content = { sizeBytes: input.bytes.length, sha256: await sha256(input.bytes) };
    const [saved] = await tx
      .insert(asset)
      .values({
        orgId: context.orgId,
        purpose: "sync_snapshot",
        bucket: policy.bucket,
        visibility: policy.visibility,
        key: input.key,
        fileName: input.key.split("/").at(-1)!,
        contentType: "application/gzip",
        ...content,
        actorId: context.actorId,
      })
      .onConflictDoUpdate({
        target: [asset.orgId, asset.key],
        set: { ...content, updatedAt: sql`now()` },
      })
      .returning({ id: asset.id });
    await input.blobs.put(context.orgId, input.key, input.bytes);
    return saved!;
  },
  audit: (input, output) => ({ assetId: output.id, key: input.key, sizeBytes: input.bytes.length }),
  details: (_input, output) => ({ entity: "asset", entityId: output.id }),
});
