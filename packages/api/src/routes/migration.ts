import { Hono, type Context } from "hono";
import * as v from "valibot";
import { publicKeyOf, verifySignedRequest, type Licence } from "@shopper/core/licence";
import type { ShopperDatabase } from "@shopper/db-pg";
import {
  commitImport,
  commitImportBody,
  getImport,
  ImportError,
  openImport,
  openImportBody,
  receiveFile,
} from "@shopper/export";
import type { Blobs, WorkflowLauncher } from "@shopper/ports";

type MigrationEnvironment = { Variables: { licence: Licence } };

/**
 * A box moving into the cloud (public on purpose: every request is signed by a licence the issuer signed, and the
 * licence names the one shop it may move). Open, send each file, then commit; the status says what is missing.
 */
export function migrationRoutes(options: {
  database: ShopperDatabase;
  blobs: Blobs;
  archiveImports: WorkflowLauncher;
  licenceSigningKey: string;
}) {
  const app = new Hono<MigrationEnvironment>();
  const db = options.database;
  app.use("/migration/*", async (c, next) => {
    const licence = await verifySignedRequest(c.req.raw, {
      issuer: publicKeyOf(options.licenceSigningKey),
    });
    if (!licence) return c.json({ error: "Not a genuine licensed box" }, 401);
    c.set("licence", licence);
    await next();
  });
  const imported = (c: Context<MigrationEnvironment>) => ({
    orgId: c.get("licence").org,
    importId: c.req.param("id")!,
  });

  app.post("/migration/imports", async (c) => {
    const body = v.parse(openImportBody, await c.req.json());
    return c.json(await openImport(db, c.get("licence"), body), 201);
  });
  app.get("/migration/imports/:id", async (c) => {
    const id = imported(c);
    return c.json(await getImport(db, id.orgId, id.importId));
  });
  app.put("/migration/imports/:id/files/*", async (c) => {
    const id = imported(c);
    const path = decodeURIComponent(c.req.path.split(`/files/`).slice(1).join("/files/"));
    await receiveFile(db, options.blobs, {
      ...id,
      path,
      bytes: new Uint8Array(await c.req.arrayBuffer()),
    });
    return c.body(null, 204);
  });
  app.post("/migration/imports/:id/commit", async (c) => {
    const body = v.parse(commitImportBody, await c.req.json());
    const result = await commitImport(
      db,
      {
        blobs: options.blobs,
        launcher: options.archiveImports,
        issuerKey: options.licenceSigningKey,
      },
      { ...imported(c), credentials: body.credentials, upstream: upstream(c) },
    );
    return c.json(result, 202);
  });
  app.onError((error, c) => {
    if (error instanceof ImportError)
      return c.json({ error: error.message, missing: error.missing }, error.status);
    if (error instanceof v.ValiError) return c.json({ error: "Invalid request" }, 400);
    throw error;
  });
  return app;
}

/** The API root the box called (the path it signed, before a host stripped its prefix): where its tills go next. */
function upstream(c: Context<MigrationEnvironment>) {
  const url = new URL(c.req.url);
  const path = c.req.header("shopper-path") ?? url.pathname;
  return `${url.origin}${path.slice(0, path.indexOf("/migration/"))}`;
}
