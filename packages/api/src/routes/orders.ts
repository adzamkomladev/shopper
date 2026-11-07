import { Hono, type Context } from "hono";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import {
  acceptStoreOrder,
  cancelStoreOrder,
  declineStoreOrder,
  dispatchStoreOrder,
  decideReview,
  finishStoreOrder,
  handOverStoreOrder,
  listFlaggedReviews,
  listOrderQueue,
  OrderError,
  readStaffOrder,
  recordPick,
  reviewInstanceId,
  startPicking,
} from "@shopper/core/orders";
import { uuidV7Schema } from "@shopper/ports";
import { orderQuery } from "../schemas/orders";
import { branchScope } from "../middleware/require/branches";
import { requirePermission } from "../middleware/require/permission";
import type { ApiEnvironment, ApiOptions } from "../types";

/**
 * The store's online orders: the queue (order.read) and every step of filling one (order.fulfil): accept or decline,
 * start picking, record each line, finish, send out, hand over, cancel. A branch-scoped member reaches only their
 * branches' orders; an order outside them is as good as not there.
 */
export function orderRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  app.onError((error, c) => {
    if (error instanceof OrderError)
      return c.json({ error: error.message, code: error.code }, error.status);
    if (v.isValiError(error)) return c.json({ error: "Invalid request data" }, 400);
    throw error;
  });
  app.use("/orders", requirePermission(options.authentication, "order.read"));
  app.use("/orders/:id", requirePermission(options.authentication, "order.read"));
  const write = requirePermission(options.authentication, "order.fulfil");
  const context = (c: Context<ApiEnvironment>) => {
    const principal = c.get("principal");
    return {
      orgId: principal.orgId,
      actorId: principal.userId,
      role: principal.roleName,
      deviceId: principal.deviceId,
      branchId: principal.branchId,
      appVersion: buildInfo.version,
      queue: options.notifications,
    };
  };
  const flows = () => {
    if (!options.orderFlows)
      throw new OrderError("conflict", "Online orders are not running here", 409);
    return options.orderFlows;
  };
  /** The order the caller may reach, or a 404: never a hint that it exists elsewhere. */
  const reach = async (c: Context<ApiEnvironment>) => {
    const id = v.parse(uuidV7Schema, c.req.param("id")?.toLowerCase());
    const found = await readStaffOrder(
      database,
      c.get("principal").orgId,
      id,
      branchScope(c.get("principal")),
    );
    if (!found) throw new OrderError("not_found", "We could not find that order");
    return found;
  };
  const answer = async (c: Context<ApiEnvironment>) => c.json(await reach(c));

  app.get("/orders", async (c) => {
    const principal = c.get("principal");
    const query = v.parse(orderQuery, c.req.query());
    const scope = branchScope(principal);
    if (scope && query.branchId && !scope.includes(query.branchId.toLowerCase()))
      return c.json({ error: "That branch is outside your access" }, 403);
    return c.json(await listOrderQueue(database, principal.orgId, { ...query, branches: scope }));
  });
  app.get("/orders/:id", answer);
  const step = (path: string, run: (c: Context<ApiEnvironment>, id: string) => Promise<unknown>) =>
    app.post(`/orders/:id/${path}`, write, async (c) => {
      const order = await reach(c);
      await run(c, order.id);
      return c.json(await reach(c));
    });
  const db = database;
  step("accept", (c, id) => acceptStoreOrder(db, context(c), flows(), id));
  step("decline", (c, id) => declineStoreOrder(db, context(c), flows(), id));
  step("start", (c, id) => startPicking(db, context(c), { id }));
  step("ready", (c, id) => finishStoreOrder(db, context(c), flows(), id));
  step("dispatch", (c, id) => dispatchStoreOrder(db, context(c), id));
  step("handover", async (c, id) => {
    await handOverStoreOrder(db, context(c), flows(), id);
    // The review workflow asks the shopper how it went after a couple of days.
    const orgId = c.get("principal").orgId;
    await options.orderReviews?.start(reviewInstanceId(id), { orgId, id });
  });
  step("cancel", (c, id) => cancelStoreOrder(db, context(c), flows(), id));
  // Reviews a moderator decides on: those the screening flagged.
  app.get("/reviews", requirePermission(options.authentication, "review.moderate"), async (c) =>
    c.json({ reviews: await listFlaggedReviews(db, c.get("principal").orgId) }),
  );
  app.post(
    "/reviews/:id/decision",
    requirePermission(options.authentication, "review.moderate"),
    async (c) => {
      const decided = await decideReview(db, context(c), {
        id: v.parse(uuidV7Schema, c.req.param("id").toLowerCase()),
        decision: (await c.req.json().catch(() => ({}))).decision,
      });
      await options.orderReviews?.send(reviewInstanceId(decided.orderId), "moderator_decision", {});
      return c.json({ id: c.req.param("id"), status: decided.status });
    },
  );
  app.put("/orders/:id/lines/:lineId", write, async (c) => {
    const order = await reach(c);
    const body = await c.req.json().catch(() => ({}));
    await recordPick(db, context(c), {
      ...body,
      id: order.id,
      lineId: c.req.param("lineId").toLowerCase(),
    });
    return c.json(await reach(c));
  });
  return app;
}
