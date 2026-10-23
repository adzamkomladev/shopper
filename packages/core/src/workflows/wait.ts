import { WorkflowTimeoutError, type Workflow } from "@shopper/ports";

/** Long sleeps wake to look again: inside every engine's event timeout and a 32-bit timer (about 24.8 days). */
export const MAX_WAIT_MS = 24 * 86_400_000;

/** An interruptible sleep: true when a "wake" event cut it short, false when it ran its time. */
export async function woken(flow: Pick<Workflow, "waitFor">, name: string, timeoutMs: number) {
  try {
    await flow.waitFor(name, "wake", timeoutMs);
    return true;
  } catch (error) {
    if (error instanceof WorkflowTimeoutError) return false;
    throw error;
  }
}
