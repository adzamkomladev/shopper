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
  get(id: string): Promise<unknown>;
}): WorkflowLauncher {
  return {
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
export function cloudflareWorkflow(instanceId: string): Workflow {
  return memoryWorkflow(instanceId);
}
