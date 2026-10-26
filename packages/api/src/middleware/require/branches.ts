import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono";
import type { ApiEnvironment, ApiPrincipal } from "../../types";

const outside = () =>
  new HTTPException(403, {
    res: Response.json({ error: "That branch is outside your access" }, { status: 403 }),
  });

/** The branches a principal may reach: a till's own, a scoped member's, or undefined for every branch. */
export const branchScope = (principal: ApiPrincipal) =>
  principal.deviceId ? [principal.branchId!] : (principal.branchIds ?? undefined);

/** Throws 403 when `branchId` (when given) lies outside the principal's branches. */
export function assertBranch(principal: ApiPrincipal, branchId: unknown) {
  const scope = branchScope(principal);
  if (scope && typeof branchId === "string" && !scope.includes(branchId.toLowerCase()))
    throw outside();
}

/** A till writes to its own branch whatever the body says; a scoped member's body must name one of theirs. */
export function scopedBody<T>(principal: ApiPrincipal, raw: unknown) {
  if (!raw || typeof raw !== "object") return raw as T;
  if (principal.deviceId) return { ...raw, branchId: principal.branchId } as T;
  assertBranch(principal, (raw as { branchId?: unknown }).branchId);
  return raw as T;
}

/**
 * A query's `branchId` checked against the scope, or, when absent and the member has exactly one branch, set to
 * it. A till always reads its own branch.
 */
export function scopedQuery(principal: ApiPrincipal, query: Record<string, string>) {
  const scope = branchScope(principal);
  if (principal.deviceId) return { ...query, branchId: principal.branchId! };
  assertBranch(principal, query.branchId);
  return !query.branchId && scope?.length === 1 ? { ...query, branchId: scope[0]! } : query;
}

/** Org-wide views (the VAT return, chain verification): refused to a branch-scoped member. */
export const requireOrgWide: MiddlewareHandler<ApiEnvironment> = async (c, next) => {
  if (branchScope(c.get("principal"))) throw outside();
  await next();
};
