import { Hono, type Context } from "hono";
import type { ShopperDatabase } from "@shopper/db-pg";
import {
  createBarcodeMapping,
  deleteBarcodeMapping,
  listBarcodeMappings,
  updateBarcodeMapping,
} from "@shopper/core/catalogue";
import type { ApiEnvironment } from "../../types";

type Ctx = Context<ApiEnvironment>;
type CommandContext = Parameters<typeof createBarcodeMapping>[1];

/** Embedded barcode layouts; the parent guard already gates reads and writes by permission. */
export function mappingRoutes(
  db: ShopperDatabase,
  context: (c: Ctx) => CommandContext,
  body: (c: Ctx) => Promise<unknown>,
) {
  const app = new Hono<ApiEnvironment>();
  app.get("/", async (c) => c.json(await listBarcodeMappings(db, c.get("principal").orgId)));
  app.post("/", async (c) =>
    c.json(await createBarcodeMapping(db, context(c), await body(c)), 201),
  );
  app.patch("/:id", async (c) =>
    c.json(
      await updateBarcodeMapping(db, context(c), { id: c.req.param("id"), data: await body(c) }),
    ),
  );
  app.delete("/:id", async (c) => {
    await deleteBarcodeMapping(db, context(c), { id: c.req.param("id") });
    return c.body(null, 204);
  });
  return app;
}
