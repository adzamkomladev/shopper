import { randomUUID } from "node:crypto";
import * as v from "valibot";
import { renderReply, type RenderRequest } from "@shopper/hardware/schemas";
import type { Renderer } from "@shopper/ports";

const TIMEOUT_MS = 15_000;
type Pending = { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void };

/** A Renderer that asks the parent process (Electron main) over IPC and correlates replies by id. */
export function parentRenderer(send: (message: RenderRequest) => void, timeoutMs = TIMEOUT_MS) {
  const pending = new Map<string, Pending>();
  const renderer: Renderer = {
    receipt: (receipt, options, format) =>
      new Promise<Uint8Array>((resolve, reject) => {
        const id = randomUUID();
        const timer = setTimeout(
          () => settle(id)?.reject(new Error("Render timed out")),
          timeoutMs,
        );
        pending.set(id, {
          resolve: (bytes) => (clearTimeout(timer), resolve(bytes)),
          reject: (error) => (clearTimeout(timer), reject(error)),
        });
        try {
          send({ type: "render", id, receipt, ...options, format });
        } catch (error) {
          settle(id)?.reject(error instanceof Error ? error : new Error("Render request failed"));
        }
      }),
    // Statements are rendered by the box server, never on a till.
    statement: () => Promise.reject(new Error("The till host does not render statements")),
  };
  const settle = (id: string) => {
    const entry = pending.get(id);
    pending.delete(id);
    return entry;
  };

  /** Consumes a render reply and returns true; any other message returns false for the caller. */
  function receive(message: unknown) {
    const reply = v.safeParse(renderReply, message);
    if (!reply.success) return false;
    const entry = settle(reply.output.id);
    if (reply.output.type === "rendered") entry?.resolve(Buffer.from(reply.output.data, "base64"));
    else entry?.reject(new Error(reply.output.message));
    return true;
  }

  /** Rejects every outstanding render, for when the parent goes away. */
  function dispose() {
    for (const id of [...pending.keys()]) settle(id)?.reject(new Error("Renderer closed"));
  }
  return { renderer, receive, dispose };
}
