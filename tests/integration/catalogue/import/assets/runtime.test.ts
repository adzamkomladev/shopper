import { expect, test } from "vite-plus/test";
import * as v from "valibot";
import { serveRuntime } from "@shopper/api/runtime";
import { boxSequencer, boxRateLimiter } from "@shopper/adapters-box";
import { importUploadGrant } from "@shopper/assets/schemas";
import { sha256 } from "@shopper/utils";
import { baseURL, context, cookies, db, deviceCache, secret } from "../../../auth/setup";
import { importStorage } from "../../../../support/assets/storage";

const rateLimiter = boxRateLimiter();

test("runtime passes object storage to authorized catalogue routes", async () => {
  const bytes = new TextEncoder().encode("SKU,Name\nRUNTIME,Runtime product");
  const blobs = await importStorage();
  const response = await serveRuntime(
    new Request(`${baseURL}/catalogue/imports/uploads`, {
      method: "POST",
      headers: {
        origin: baseURL,
        cookie: cookies.get("superadmin")!,
        "X-Shopper-Org": context.orgId,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileName: "runtime.csv",
        contentType: "text/csv",
        sizeBytes: bytes.length,
        sha256: await sha256(bytes),
      }),
    }),
    {
      database: db,
      cache: deviceCache.cache,
      rateLimiter,
      sequencer: boxSequencer(db),
      baseURL,
      secret,
      blobs,
    },
  );
  expect(response.status).toBe(201);
  const grant = v.parse(importUploadGrant, await response.json());
  expect(new URL(grant.url).port).toBe("9200");
  const uploaded = await fetch(grant.url, {
    method: grant.method,
    headers: grant.headers,
    body: bytes,
  });
  expect(uploaded.ok).toBe(true);
  expect(await blobs.get(context.orgId, `imports/${grant.assetId}`, bytes.length)).toEqual(bytes);
});
