import { Hono, type Context } from "hono";
import {
  listFiscalArchives,
  listFiscalDocs,
  readFiscalDoc,
  retryFiscalDoc,
} from "@shopper/core/fiscal";
import type { Blobs, Lane } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import { commandContext } from "../stock/context";
import { problem } from "../../middleware/problem";
import { branchScope, requireOrgWide } from "../../middleware/require/branches";
import { requirePermission } from "../../middleware/require/permission";
import type { ApiAuthentication, ApiEnvironment } from "../../types";

/**
 * The fiscal dashboard: documents by status, each with its payload and the SDC's answer, and the hourly archive
 * (tax.read). Retrying a dead-lettered document (tax.write) puts it back at the end of its store's lane.
 */
export function fiscalRoutes(options: {
  database: ShopperDatabase;
  authentication: ApiAuthentication | undefined;
  lane?: Lane;
  blobs?: Blobs;
}) {
  const app = new Hono<ApiEnvironment>();
  const read = requirePermission(options.authentication, "tax.read");
  app.get("/tax/fiscal", read);
  // Archives are per store, not per branch: org-wide members only.
  app.get("/tax/fiscal/archives", read, requireOrgWide);
  app.get("/tax/fiscal/:id", read);
  app.post("/tax/fiscal/:id/retry", requirePermission(options.authentication, "tax.write"));
  const org = (c: Context<ApiEnvironment>) => c.get("principal").orgId;
  const scope = (c: Context<ApiEnvironment>) => branchScope(c.get("principal"));

  app.get("/tax/fiscal", async (c) =>
    c.json({
      connected: !!options.lane,
      ...(await listFiscalDocs(options.database, org(c), c.req.query(), scope(c))),
    }),
  );
  app.get("/tax/fiscal/archives", async (c) =>
    c.json(await listFiscalArchives(options.database, org(c), c.req.query(), options.blobs)),
  );
  app.get("/tax/fiscal/:id", async (c) =>
    c.json(await readFiscalDoc(options.database, org(c), c.req.param("id"), scope(c))),
  );
  app.post("/tax/fiscal/:id/retry", async (c) => {
    const id = c.req.param("id");
    await readFiscalDoc(options.database, org(c), id, scope(c));
    const { storeId } = await retryFiscalDoc(options.database, commandContext(c.get("principal")), {
      docId: id,
    });
    await options.lane?.enqueue(org(c), storeId, id);
    return c.json(await readFiscalDoc(options.database, org(c), id));
  });
  app.onError(problem);
  return app;
}
