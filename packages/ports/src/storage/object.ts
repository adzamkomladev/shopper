import { objectStorageOptionsSchema } from "../schemas/storage";
import type { ObjectStorageOptions } from "./types";
export type { ObjectStorageOptions } from "./types";
import * as v from "valibot";
import { AwsClient } from "aws4fetch";
import { scopedKey } from "../storage";
import type { BlobUploadOptions } from "../types";

export function objectStorage(options: ObjectStorageOptions) {
  v.parse(objectStorageOptionsSchema, options);
  const aws = new AwsClient({ ...options, service: "s3", retries: 0 });
  const now = options.now ?? Date.now;
  const url = (orgId: string, key: string) => {
    const result = new URL(options.endpoint);
    result.pathname = `${result.pathname.replace(/\/$/, "")}/${options.bucket}/${scopedKey(orgId, key)}`;
    return result;
  };
  // A query-signed request for one key, valid for `seconds` from now.
  const presign = async (
    orgId: string,
    key: string,
    seconds: number,
    method: "GET" | "PUT",
    headers: Record<string, string> = {},
  ) => {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
      throw new RangeError("Grant lifetime must be 1–3600 seconds");
    const target = url(orgId, key);
    target.searchParams.set("X-Amz-Expires", String(seconds));
    const instant = now();
    const request = await aws.sign(target, {
      method,
      headers,
      aws: {
        signQuery: true,
        allHeaders: true,
        datetime: new Date(instant).toISOString().replace(/[:-]|\.\d{3}/g, ""),
      },
    });
    return { url: request.url, expiresAt: instant + seconds * 1000 };
  };
  return {
    async createUpload(orgId: string, key: string, input: BlobUploadOptions) {
      const headers = { "Content-Type": input.contentType };
      const grant = await presign(orgId, key, input.expiresInSeconds, "PUT", headers);
      return { url: grant.url, method: "PUT" as const, headers, expiresAt: grant.expiresAt };
    },
    async createDownload(orgId: string, key: string, expiresInSeconds: number) {
      return (await presign(orgId, key, expiresInSeconds, "GET")).url;
    },
    async put(orgId: string, key: string, value: Uint8Array) {
      await checked(
        await aws.fetch(url(orgId, key), { method: "PUT", body: new Uint8Array(value) }),
      );
    },
    async get(orgId: string, key: string, maxBytes?: number) {
      const response = await aws.fetch(url(orgId, key));
      if (response.status === 404) return null;
      await checked(response);
      return readBlobBody(
        response.body,
        Number(response.headers.get("Content-Length")) || undefined,
        maxBytes,
      );
    },
    async delete(orgId: string, key: string) {
      await checked(await aws.fetch(url(orgId, key), { method: "DELETE" }));
    },
  };
}

export async function readBlobBody(
  body: ReadableStream<Uint8Array> | null,
  size?: number,
  maxBytes?: number,
) {
  if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 0))
    throw new RangeError("Invalid blob size limit");
  if (maxBytes !== undefined && size !== undefined && size > maxBytes) {
    await body?.cancel();
    throw new RangeError("Blob exceeds size limit");
  }
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (maxBytes !== undefined && length > maxBytes) {
        await reader.cancel();
        throw new RangeError("Blob exceeds size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function checked(response: Response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Object storage request failed (${response.status})`);
  }
}
