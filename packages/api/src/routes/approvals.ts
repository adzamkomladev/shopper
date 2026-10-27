import { Hono, type Context } from "hono";
import * as v from "valibot";
import { and, desc, eq, inArray } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { approvalRequest, user } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import {
  approvalDecision,
  approvalInput,
  approvalListQuery,
  approvalView,
  decideApproval,
  requestApproval,
} from "@shopper/core/approvals";
import { problem } from "../middleware/problem";
import { branchScope } from "../middleware/require/branches";
import type { ApiEnvironment, ApiOptions, ApiPrincipal } from "../types";

const permissionOf = { refund: "refund.approve", discount: "sale.discount" } as const;

/**
 * Remote manager approval. A register asks (`POST /approvals`) and follows its own request; a manager holding the
 * matching permission sees the pending requests of their branches and answers one, which wakes its workflow.
 */
export function approvalRoutes(options: ApiOptions) {
  const app = new Hono<ApiEnvironment>();
  const database = options.database!;
  // A register's cashier session or a back-office member, either way a principal of this org.
  app.use("/approvals/*", principal(options));
  app.use("/approvals", principal(options));
  const context = (p: ApiPrincipal) => ({
    orgId: p.orgId,
    actorId: p.userId,
    role: p.roleName,
    deviceId: p.deviceId,
    branchId: p.branchId,
    appVersion: buildInfo.version,
    queue: options.notifications,
  });
  const approves = (p: ApiPrincipal) =>
    Promise.all(
      (["refund", "discount"] as const).map(async (kind) =>
        (await options.authentication!.hasPermission(p, permissionOf[kind])) ? [kind] : [],
      ),
    ).then((kinds) => kinds.flat());

  app.post("/approvals", async (c) => {
    const p = c.get("principal");
    if (!p.deviceId || !p.branchId) return c.json({ error: "Only a register can ask" }, 403);
    if (!options.approvals) return c.json({ error: "Remote approval is unavailable" }, 503);
    const input = v.parse(approvalInput, await c.req.json());
    const asks = input.kind === "refund" ? "refund.request" : "sale.create";
    if (!(await options.authentication!.hasPermission(p, asks)))
      return c.json({ error: "Permission denied" }, 403);
    const saved = await requestApproval(database, context(p), {
      ...input,
      deviceId: p.deviceId,
      branchId: p.branchId,
      at: new Date(),
    });
    await options.approvals.start(saved.id, { orgId: p.orgId, id: saved.id });
    return c.json(saved, 201);
  });
  app.get("/approvals", async (c) => {
    const p = c.get("principal");
    const query = v.parse(approvalListQuery, c.req.query());
    const kinds = p.deviceId ? [] : await approves(p);
    if (!kinds.length) return c.json({ error: "Permission denied" }, 403);
    const scope = branchScope(p);
    const rows = await database
      .select({ request: approvalRequest, requesterName: user.name })
      .from(approvalRequest)
      .innerJoin(
        user,
        and(eq(user.orgId, approvalRequest.orgId), eq(user.id, approvalRequest.requestedBy)),
      )
      .where(
        and(
          eq(approvalRequest.orgId, p.orgId),
          eq(approvalRequest.status, query.status),
          inArray(approvalRequest.kind, kinds),
          scope ? inArray(approvalRequest.branchId, scope.length ? scope : [p.orgId]) : undefined,
        ),
      )
      .orderBy(desc(approvalRequest.createdAt))
      .limit(100);
    return c.json({
      approvals: rows.map((row) => ({
        ...approvalView(row.request),
        requesterName: row.requesterName,
      })),
    });
  });
  app.get("/approvals/:id", async (c) => {
    const p = c.get("principal");
    const row = await find(c);
    const visible =
      row &&
      (p.deviceId
        ? row.deviceId === p.deviceId
        : (await approves(p)).includes(row.kind) &&
          (!branchScope(p) || branchScope(p)!.includes(row.branchId)));
    if (!visible) return c.json({ error: "Approval not found" }, 404);
    return c.json(approvalView(row));
  });
  app.post("/approvals/:id/decision", async (c) => {
    const p = c.get("principal");
    if (p.deviceId) return c.json({ error: "Answer from the back office" }, 403);
    const row = await find(c);
    if (!row || (branchScope(p) && !branchScope(p)!.includes(row.branchId)))
      return c.json({ error: "Approval not found" }, 404);
    if (!(await options.authentication!.hasPermission(p, permissionOf[row.kind])))
      return c.json({ error: "Permission denied" }, 403);
    const input = v.parse(approvalDecision, await c.req.json());
    const saved = await decideApproval(database, context(p), {
      ...input,
      id: row.id,
      at: new Date(),
    });
    await options.approvals?.send(row.id, "manager_approval", { status: saved.status });
    return c.json(saved);
  });
  app.onError(problem);
  return app;

  async function find(c: Context<ApiEnvironment>) {
    const id = c.req.param("id");
    if (!v.is(uuidV7Schema, id)) return undefined;
    const [row] = await database
      .select()
      .from(approvalRequest)
      .where(
        and(
          eq(approvalRequest.orgId, c.get("principal").orgId),
          eq(approvalRequest.id, id.toLowerCase()),
        ),
      );
    return row;
  }
}

function principal(options: ApiOptions) {
  return async (c: Context<ApiEnvironment>, next: () => Promise<void>) => {
    const found =
      (await options.devices?.resolveDevicePrincipal(c.req.raw)) ??
      (await options.authentication?.resolvePrincipal(c.req.raw));
    if (!found || !options.authentication) return c.json({ error: "Authentication required" }, 401);
    c.set("principal", found);
    await next();
  };
}
