import * as v from "valibot";

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
