import { and, eq } from "drizzle-orm";
import { MAX_PRODUCT_IMAGE_BYTES } from "@shopper/assets/schemas";
import { asset, type ShopperDatabase } from "@shopper/db-pg";
import type { BlobUpload, Blobs } from "@shopper/ports";
import type { RelaySend } from "./types";

/**
 * Before a batch names a photo, the relay must hold it: each digest is offered once per run, and its bytes go
 * straight to the relay's storage only when the relay asks for them (a grant), so an unchanged photo is never sent
 * again. Returns the relay's refusal, if it refused, for the Publisher to record.
 */
export async function sendPhotos(
  db: ShopperDatabase,
  orgId: string,
  digests: (string | null | undefined)[],
  send: RelaySend,
  blobs: (() => Promise<Blobs>) | undefined,
  offered: Set<string>,
) {
  for (const digest of new Set(digests)) {
    if (!digest || offered.has(digest)) continue;
    const [photo] = await db
      .select({ key: asset.key, contentType: asset.contentType, sizeBytes: asset.sizeBytes })
      .from(asset)
      .where(
        and(eq(asset.orgId, orgId), eq(asset.sha256, digest), eq(asset.purpose, "product_image")),
      )
      .limit(1);
    if (!photo) throw new Error("A product photo is missing on the box");
    const response = await send("/relay/images", {
      method: "POST",
      body: JSON.stringify({
        sha256: digest,
        sizeBytes: photo.sizeBytes,
        contentType: photo.contentType,
      }),
    });
    if ([401, 402, 403].includes(response.status)) return response;
    if (!response.ok) throw new Error(`The relay answered ${response.status} for a photo`);
    const offer = (await response.json()) as { upload?: BlobUpload };
    if (offer.upload) {
      const bytes = await (await blobs?.())?.get(orgId, photo.key, MAX_PRODUCT_IMAGE_BYTES);
      if (!bytes) throw new Error("A product photo is missing from the box's storage");
      const put = await fetch(offer.upload.url, {
        method: offer.upload.method,
        headers: offer.upload.headers,
        body: new Uint8Array(bytes),
      });
      if (!put.ok) throw new Error(`Storage refused a product photo (${put.status})`);
    }
    offered.add(digest);
  }
  return undefined;
}
