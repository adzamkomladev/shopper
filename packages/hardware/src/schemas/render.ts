import * as v from "valibot";

/** Host → Electron main (Node IPC): render one stored receipt. */
export const renderRequest = v.object({
  type: v.literal("render"),
  id: v.string(),
  receipt: v.unknown(),
  paperMm: v.picklist([58, 80]),
  reprint: v.boolean(),
  format: v.picklist(["pdf", "png"]),
});

/** Electron main → host: the bytes as base64, or why rendering failed. */
export const renderReply = v.variant("type", [
  v.object({ type: v.literal("rendered"), id: v.string(), data: v.string() }),
  v.object({ type: v.literal("render-failed"), id: v.string(), message: v.string() }),
]);

export type RenderRequest = v.InferOutput<typeof renderRequest>;
export type RenderReply = v.InferOutput<typeof renderReply>;
