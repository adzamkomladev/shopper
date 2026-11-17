import * as v from "valibot";

/** What an owner checks before a move in either direction; both only advise. */
export const preflightChecks = v.object({
  quiet: v.object({ ok: v.boolean(), lastSaleAt: v.nullable(v.string()) }),
  dryRun: v.object({
    ok: v.boolean(),
    exportJobId: v.nullable(v.string()),
    sealedAt: v.nullable(v.string()),
    minutes: v.nullable(v.number()),
  }),
});
export type PreflightChecks = v.InferOutput<typeof preflightChecks>;

/** A dry run: the archive sealed with nothing frozen, then read back as the other side will read it. */
export const dryRun = v.union([
  v.object({ status: v.picklist(["running", "failed", "deleted"]) }),
  v.object({
    status: v.literal("ready"),
    verified: v.boolean(),
    message: v.nullable(v.string()),
    tables: v.number(),
    rows: v.number(),
    files: v.number(),
    bytes: v.number(),
    minutes: v.number(),
  }),
]);
export const dryRunStarted = v.object({ exportJobId: v.string() });

export const moveStatus = v.picklist(["sealing", "uploading", "importing", "moved", "failed"]);

/** The box's move to the cloud, and each register with when its next connection handed it the new address. */
export const moveView = v.object({
  move: v.nullable(
    v.object({
      id: v.string(),
      status: moveStatus,
      cloudUrl: v.string(),
      error: v.nullable(v.string()),
      startedAt: v.string(),
      completedAt: v.nullable(v.string()),
    }),
  ),
  checks: preflightChecks,
  registers: v.array(
    v.object({ id: v.string(), name: v.string(), deliveredAt: v.nullable(v.string()) }),
  ),
});
export type MoveView = v.InferOutput<typeof moveView>;

export const moveStarted = v.object({ id: v.string() });

/** A cloud shop's move onto its own box; `archived` once the box's report agreed, `cancelled` when called off. */
export const onPremStatus = v.picklist(["open", "claimed", "archived", "cancelled"]);

/** The cloud's account of the shop set against the box's: each table and day, ok only when both sides agree. */
export const comparison = v.object({
  ok: v.boolean(),
  tables: v.array(
    v.object({
      table: v.string(),
      cloud: v.object({ rows: v.number() }),
      box: v.object({ rows: v.number() }),
      ok: v.boolean(),
    }),
  ),
  days: v.array(v.object({ day: v.string(), ok: v.boolean() })),
});
export type Comparison = v.InferOutput<typeof comparison>;

export const onPremView = v.object({
  move: v.nullable(
    v.object({
      id: v.string(),
      status: onPremStatus,
      archive: v.picklist(["running", "ready", "failed", "deleted"]),
      exportJobId: v.string(),
      licence: v.nullable(v.unknown()),
      boxUpstream: v.nullable(v.string()),
      report: v.nullable(comparison),
      startedAt: v.string(),
      completedAt: v.nullable(v.string()),
    }),
  ),
  checks: preflightChecks,
  registers: v.array(
    v.object({ id: v.string(), name: v.string(), deliveredAt: v.nullable(v.string()) }),
  ),
});
export type OnPremView = v.InferOutput<typeof onPremView>;

export const onPremStarted = v.object({ exportJobId: v.string() });
export const onPremCancelled = v.object({ moveId: v.string() });
export const onPremLicence = v.record(v.string(), v.unknown());
/** What a box that took over a cloud shop answers: the shop, and the cloud's comparison of the two copies. */
export const arrival = v.object({ ...comparison.entries, shop: v.string() });
