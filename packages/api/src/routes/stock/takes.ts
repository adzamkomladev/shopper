import { Hono, type Context } from "hono";
import {
  cancelTake,
  countTake,
  listTakes,
  postTake,
  readTake,
  startTake,
} from "@shopper/core/stock";
import type { Queue } from "@shopper/ports";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { ApiEnvironment } from "../../types";
import type { TakeCounts, TakeStart } from "@shopper/core/schemas";
import { commandContext, forceBranch, onlyBranch } from "./context";

type Ctx = Context<ApiEnvironment>;

/** Stock takes under /stock/takes; the caller's guard has set the principal. */
export function takeRoutes(database: ShopperDatabase, notifications?: Queue) {
  const app = new Hono<ApiEnvironment>();
  const principal = (c: Ctx) => c.get("principal");
  const body = (c: Ctx) => c.req.json().catch(() => undefined);
  const view = async (c: Ctx, id: string, status: 200 | 201 = 200) =>
    c.json(await readTake(database, principal(c).orgId, id, onlyBranch(principal(c))), status);

  app.get("/", async (c) => {
    const branch = onlyBranch(principal(c));
    return c.json(
      await listTakes(
        database,
        principal(c).orgId,
        branch ? { ...c.req.query(), branchId: branch } : c.req.query(),
      ),
    );
  });
  app.post("/", async (c) => {
    const take = forceBranch<TakeStart>(principal(c), await body(c));
    const { id, replayed } = await startTake(
      database,
      commandContext(principal(c), notifications),
      { take },
    );
    return view(c, id, replayed ? 200 : 201);
  });
  app.get("/:id", async (c) => view(c, c.req.param("id")));
  app.put("/:id/counts", async (c) => {
    const { id } = await countTake(database, commandContext(principal(c), notifications), {
      takeId: c.req.param("id"),
      counts: (await body(c)) as TakeCounts,
      now: new Date(),
    });
    return view(c, id);
  });
  app.post("/:id/post", async (c) => {
    const { id } = await postTake(database, commandContext(principal(c), notifications), {
      takeId: c.req.param("id"),
      now: new Date(),
    });
    return view(c, id);
  });
  app.post("/:id/cancel", async (c) => {
    const { id } = await cancelTake(database, commandContext(principal(c), notifications), {
      takeId: c.req.param("id"),
      now: new Date(),
    });
    return view(c, id);
  });
  return app;
}
