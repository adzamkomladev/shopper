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
