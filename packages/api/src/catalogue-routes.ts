import { Hono, type Context } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import type { ShopperDatabase } from "@shopper/db-pg";
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
  readPriceAt,
  removeBarcode,
  saveCategory,
  saveSupplier,
  setPrice,
  updateProduct,
} from "@shopper/core/catalogue";
import { requirePermission, type ApiAuthentication, type ApiEnvironment } from "./auth-middleware";

type Ctx = Context<ApiEnvironment>;
const priceBody = v.looseObject({
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500)),
});

/** Catalogue API: reads need product.read, writes product.write. Errors are mapped once, below. */
export function catalogueRoutes(options: {
  database: ShopperDatabase;
  authentication?: ApiAuthentication;
}) {
  const db = options.database;
  const app = new Hono<ApiEnvironment>();
  const guard = requirePermission(options.authentication, (request) =>
    request.method === "GET" ? "product.read" : "product.write",
  );
  for (const root of ["products", "barcodes", "prices", "categories", "suppliers"])
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
    const data = await body(c);
    const { reason } = v.parse(priceBody, data);
    const { reason: _reason, ...price } = data as Record<string, unknown>;
    const result = await setPrice(db, context(c, reason), {
      productId: c.req.param("id"),
      data: price,
    });
    return c.json(result.after, 201);
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

  app.onError((error, c) => {
    if (v.isValiError(error)) return c.json({ error: "Invalid request data" }, 400);
    if (error instanceof ManagementError) return c.json({ error: error.message }, error.status);
    const pg = error as { code?: string; cause?: { code?: string } };
    const code = pg.code ?? pg.cause?.code;
    if (code === "23505") return c.json({ error: "Already exists" }, 409);
    if (code === "23503")
      return c.json({ error: "Referenced record does not exist or is in use" }, 409);
    throw error;
  });
  return app;
}
