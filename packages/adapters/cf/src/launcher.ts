import * as v from "valibot";
import {
  memoryWorkflow,
  workflowInstanceIdSchema,
  type Json,
  type Workflow,
  type WorkflowLauncher,
} from "@shopper/ports";

// Starting an id that already exists is a no-op, as on the box: create() throws, get() proves it exists.
export function cloudflareLauncher(binding: {
  create(options: { id: string; params: Json }): Promise<unknown>;
  get(id: string): Promise<{
    sendEvent(event: { type: string; payload: Json }): Promise<void>;
    status(): Promise<{ status: string }>;
  }>;
}): WorkflowLauncher {
  return {
    async send(id, type, payload) {
      v.parse(workflowInstanceIdSchema, id);
      const instance = await binding.get(id);
      const terminal = new Set(["complete", "errored", "terminated"]);
      if (terminal.has((await instance.status()).status)) return;
      try {
        await instance.sendEvent({ type, payload });
      } catch (error) {
        if (!terminal.has((await instance.status()).status)) throw error;
      }
    },
    async start(instanceId, params) {
      v.parse(workflowInstanceIdSchema, instanceId);
      try {
        await binding.create({ id: instanceId, params });
      } catch (error) {
        const exists = await binding.get(instanceId).then(
          () => true,
          () => false,
        );
        if (!exists) throw error;
        console.warn({ event: "workflow.already_started", instanceId });
      }
    },
  };
}
type Binding = {
  create(options: { id: string; params: Json }): Promise<unknown>;
  get(id: string): Promise<{
    sendEvent(event: { type: string; payload: Json }): Promise<void>;
    status(): Promise<{ status: string }>;
    restart(): Promise<void>;
  }>;
};

/**
 * For a workflow that loops until it has nothing to do and may be needed again (one per customer or org): start
 * creates it, wakes it with `wakeType` while it runs, and restarts it, with its first params, once it has ended.
 */
export function cloudflareLoopLauncher(binding: Binding, wakeType: string): WorkflowLauncher {
  const plain = cloudflareLauncher(binding);
  const ended = new Set(["complete", "errored", "terminated"]);
  return {
    send: plain.send,
    async start(instanceId, params) {
      v.parse(workflowInstanceIdSchema, instanceId);
      try {
        return void (await binding.create({ id: instanceId, params }));
      } catch (error) {
        const instance = await binding.get(instanceId).catch(() => undefined);
        if (!instance) throw error;
        if (ended.has((await instance.status()).status)) await instance.restart();
        else await plain.send(instanceId, wakeType, {});
      }
    },
  };
}

export function cloudflareWorkflow(instanceId: string): Workflow {
  return memoryWorkflow(instanceId);
}
