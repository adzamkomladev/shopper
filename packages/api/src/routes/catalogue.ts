import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";
import { publishStoreChanged } from "@shopper/core/changes";
import { assetReference } from "@shopper/assets/schemas";
import { issueImportUpload, readImportAsset } from "@shopper/assets";
import type { Blobs, Queue, Realtime, WorkflowLauncher } from "@shopper/ports";
import { ManagementError } from "@shopper/core/management";
import {
  addBarcode,
  archiveProduct,
  createProduct,
  findByBarcode,
  getProduct,
  listCategories,
  listProducts,
  listSuppliers,
  previewImport,
  readImport,
  readImportedAsset,
  readPriceAt,
  runImport,
  removeBarcode,
  saveCategory,
  saveSupplier,
  setPrice,
  updateProduct,
  schedulePrice,
} from "@shopper/core/catalogue";
import { mappingRoutes } from "./catalogue/mappings";
import { problem } from "../middleware/problem";
import { requirePermission } from "../middleware/require/permission";
import { priceBody } from "../schemas/catalogue";
import type { ApiAuthentication, ApiEnvironment } from "../types";

const MAX_ASSET_METADATA_BYTES = 4 * 1024;
type Ctx = Context<ApiEnvironment>;
// The reason goes to the audit row, the rest is the price itself.
function withReason(data: unknown) {
  const { reason, ...price } = v.parse(priceBody, data);
  return { reason, price };
}

/** Catalogue API: reads need product.read, writes product.write. Errors are mapped once, below. */
export function catalogueRoutes(options: {
  database: ShopperDatabase;
  authentication?: ApiAuthentication;
  priceChange?: WorkflowLauncher;
  realtime?: Realtime;
  blobs?: Blobs;
  /** Carries what a catalogue write wakes once it commits, such as the shop's onboarding. */
  notifications?: Queue;
}) {
  const db = options.database;
  const app = new Hono<ApiEnvironment>();
  const guard = requirePermission(options.authentication, (request) =>
    request.method === "GET"
      ? "product.read"
      : new URL(request.url).pathname.startsWith("/suppliers")
        ? "stock.write"
        : "product.write",
  );
  for (const root of ["products", "barcodes", "prices", "categories", "suppliers", "catalogue"])
    app.use(`/${root}`, guard).use(`/${root}/*`, guard);

  const org = (c: Ctx) => c.get("principal").orgId;
  const context = (c: Ctx, reason?: string) => {
    const principal = c.get("principal");
    return {
      orgId: principal.orgId,
      actorId: principal.userId,
      role: principal.roleName,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      appVersion: buildInfo.version,
      reason,
      queue: options.notifications,
      onStoreChanged: options.realtime
        ? async (storeId: string, sequence: string) => {
            await publishStoreChanged(options.realtime!, principal.orgId, storeId, sequence);
          }
        : undefined,
    };
  };
  const body = (c: Ctx) =>
    c.req.json().catch(() => {
      throw new ManagementError("Invalid JSON", 400);
    });
  // A till always prices for its own branch, whatever the query says.
  const lookup = (c: Ctx) => {
    const principal = c.get("principal");
    const { branchId, ...rest } = c.req.query();
    return { ...rest, ...(principal.deviceId ? { branchId: principal.branchId } : { branchId }) };
  };
  const detail = async (c: Ctx, id: string) => {
    const found = await getProduct(db, org(c), id);
    if (!found) throw new ManagementError("Record not found");
    return found;
  };

  app.get("/products", async (c) => c.json(await listProducts(db, org(c), c.req.query())));
  app.post("/products", async (c) => {
    const { id } = await createProduct(db, context(c), await body(c));
    return c.json(await detail(c, id), 201);
  });
  app.get("/products/:id", async (c) => c.json(await detail(c, c.req.param("id"))));
  app.patch("/products/:id", async (c) => {
    const { id } = await updateProduct(db, context(c), {
      id: c.req.param("id"),
      data: await body(c),
    });
    return c.json(await detail(c, id));
  });
  app.delete("/products/:id", async (c) => {
    await archiveProduct(db, context(c), { id: c.req.param("id") });
    return c.body(null, 204);
  });
  app.post("/products/:id/barcodes", async (c) => {
    const productId = c.req.param("id");
    await addBarcode(db, context(c), { productId, data: await body(c) });
    return c.json((await detail(c, productId)).barcodes, 201);
  });
  app.delete("/products/:id/barcodes/:code", async (c) => {
    await removeBarcode(db, context(c), {
      productId: c.req.param("id"),
      code: c.req.param("code"),
    });
    return c.body(null, 204);
  });
  app.post("/products/:id/prices", async (c) => {
    const { reason, price } = withReason(await body(c));
    const result = await setPrice(db, context(c, reason), {
      productId: c.req.param("id"),
      data: price,
    });
    return c.json(result.after, 201);
  });
  app.post("/products/:id/prices/schedule", async (c) => {
    const launcher = options.priceChange;
    if (!launcher) return c.json({ error: "Scheduled price changes are unavailable" }, 503);
    const { reason, price } = withReason(await body(c));
    const result = await schedulePrice(db, context(c, reason), {
      productId: c.req.param("id"),
      data: price,
      launch: (id, params) => launcher.start(id, params),
    });
    return c.json(result, 201);
  });
  app.get("/barcodes/:code", async (c) => {
    const found = await findByBarcode(db, org(c), c.req.param("code"), lookup(c));
    if (!found) throw new ManagementError("Record not found");
    return c.json(found);
  });
  app.get("/prices/at", async (c) => {
    const found = await readPriceAt(db, org(c), lookup(c));
    if (!found) throw new ManagementError("No price in force");
    return c.json(found);
  });

  app.get("/categories", async (c) => c.json(await listCategories(db, org(c))));
  app.get("/suppliers", async (c) => c.json(await listSuppliers(db, org(c))));
  for (const [path, save] of [
    ["categories", saveCategory],
    ["suppliers", saveSupplier],
  ] as const) {
    app.post(`/${path}`, async (c) =>
      c.json((await save(db, context(c), { data: await body(c) })).after, 201),
    );
    app.patch(`/${path}/:id`, async (c) =>
      c.json((await save(db, context(c), { id: c.req.param("id"), data: await body(c) })).after),
    );
  }

  const metadata = bodyLimit({
    maxSize: MAX_ASSET_METADATA_BYTES,
    onError: (c) => c.json({ error: "Asset metadata is too large" }, 413),
  });
  app.use("/catalogue/imports", metadata).use("/catalogue/imports/*", metadata);
  app.post("/catalogue/imports/uploads", async (c) => {
    if (!c.req.header("content-type")?.startsWith("application/json"))
      return c.json({ error: "Send asset metadata as JSON" }, 415);
    if (!options.blobs) return c.json({ error: "Direct uploads are unavailable" }, 503);
    const { record: _record, ...grant } = await issueImportUpload(db, context(c), {
      blobs: options.blobs,
      data: await body(c),
    });
    return c.json(grant, 201);
  });
  app.post("/catalogue/imports", async (c) => {
    if (!c.req.header("content-type")?.startsWith("application/json"))
      return c.json({ error: "Send an uploaded asset reference as JSON" }, 415);
    const { assetId } = v.parse(assetReference, await body(c));
    if (!options.blobs) return c.json({ error: "Direct uploads are unavailable" }, 503);
    if (c.req.query("dryRun") !== "1") {
      const saved = await readImportedAsset(db, org(c), assetId);
      if (saved) {
        const { sha256: _hash, ...result } = saved;
        return c.json({ dryRun: false, ...result }, 201);
      }
    }
    const source = await readImportAsset(db, options.blobs, org(c), assetId);
    if (c.req.query("dryRun") === "1") return c.json(await previewImport(db, org(c), source.bytes));
    return c.json(
      await runImport(db, context(c), source.bytes, source.asset.fileName, assetId),
      201,
    );
  });
  app.get("/catalogue/imports/:id", async (c) =>
    c.json(await readImport(db, org(c), c.req.param("id"))),
  );

  app.route("/catalogue/barcodes/mappings", mappingRoutes(db, context, body));

  app.onError(problem);
  return app;
}
