import { BlobUploadUnavailable } from "./storage/errors";
import type { BlobUrlOptions } from "./storage/types";
import * as v from "valibot";
import { jsonSchema, uuidV7Schema } from "./schemas/primitives";
import type { Blobs, Cache, CacheReader, CacheWriter } from "./types";
export function scopedKey(orgId: string, key: string): string {
  v.parse(uuidV7Schema, orgId);
  if (
    !key ||
    !/^[a-zA-Z0-9_./-]+$/.test(key) ||
    key.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid storage key");
  }
  return `${orgId}/${key}`;
}
export function requestCache(operations: CacheReader & CacheWriter): Cache {
  return {
    request() {
      let written = false;
      return {
        async get(orgId, key) {
          if (written) throw new Error("Cache read-after-write is forbidden in a request");
          scopedKey(orgId, key);
          return operations.get(orgId, key);
        },
        async put(orgId, key, value, ttlMs) {
          scopedKey(orgId, key);
          if (
            !Number.isSafeInteger(ttlMs) ||
            ttlMs <= 0 ||
            !Number.isSafeInteger(Date.now() + ttlMs)
          )
            throw new RangeError("Invalid cache TTL");
          v.parse(jsonSchema, value);
          written = true;
          await operations.put(orgId, key, value, ttlMs);
        },
        async delete(orgId, key) {
          scopedKey(orgId, key);
          written = true;
          await operations.delete(orgId, key);
        },
      };
    },
  };
}
export async function blobUrlAccess(options: BlobUrlOptions) {
  if (options.secret.byteLength < 32)
    throw new Error("Blob signing secret must contain at least 32 bytes");
  const key = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(options.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const now = options.now ?? Date.now;
  const data = (orgId: string, name: string, expires: number) =>
    new TextEncoder().encode(JSON.stringify([orgId, name, expires]));
  return {
    async sign(this: void, orgId: string, name: string, seconds: number) {
      scopedKey(orgId, name);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
        throw new RangeError("Signed URL lifetime must be 1–3600 seconds");
      const expires = Math.floor(now() / 1000) + seconds;
      const signature = new Uint8Array(
        await crypto.subtle.sign("HMAC", key, data(orgId, name, expires)),
      );
      const url = new URL(options.baseUrl);
      url.searchParams.set("org", orgId);
      url.searchParams.set("key", name);
      url.searchParams.set("expires", String(expires));
      url.searchParams.set(
        "signature",
        Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      );
      return url.toString();
    },
    async read(
      this: void,
      urlString: string,
      blobs: Pick<Blobs, "get">,
    ): Promise<Uint8Array | null> {
      const url = new URL(urlString);
      const orgId = url.searchParams.get("org") ?? "";
      const name = url.searchParams.get("key") ?? "";
      const expires = Number(url.searchParams.get("expires"));
      const signature = url.searchParams.get("signature") ?? "";
      if (
        !Number.isSafeInteger(expires) ||
        expires <= Math.floor(now() / 1000) ||
        !/^[a-f0-9]{64}$/.test(signature)
      )
        throw new Error("Invalid or expired blob URL");
      const bytes = Uint8Array.from(signature.match(/../g)!, (byte) => parseInt(byte, 16));
      if (!(await crypto.subtle.verify("HMAC", key, bytes, data(orgId, name, expires))))
        throw new Error("Invalid blob URL signature");
      scopedKey(orgId, name);
      return blobs.get(orgId, name);
    },
  };
}
export function storedBlobs(
  storage: {
    setItemRaw(key: string, value: Uint8Array): Promise<void>;
    getItemRaw(key: string): Promise<unknown>;
    removeItem(key: string): Promise<void>;
  },
  access: Awaited<ReturnType<typeof blobUrlAccess>>,
): Blobs {
  return {
    async put(orgId, key, value) {
      await storage.setItemRaw(scopedKey(orgId, key), value);
    },
    async get(orgId, key, maxBytes) {
      if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 0))
        throw new RangeError("Invalid blob size limit");
      const value = await storage.getItemRaw(scopedKey(orgId, key));
      if (value === null || value === undefined) return null;
      if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
        if (maxBytes !== undefined && value.byteLength > maxBytes)
          throw new RangeError("Blob exceeds size limit");
        return new Uint8Array(value);
      }
      throw new TypeError("Blob driver did not return binary data");
    },
    async delete(orgId, key) {
      await storage.removeItem(scopedKey(orgId, key));
    },
    async createUpload() {
      throw new BlobUploadUnavailable();
    },
    signedUrl: access.sign,
  };
}
