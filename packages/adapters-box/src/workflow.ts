import { memoryWorkflow, type Workflow } from "@shopper/ports";

export function boxWorkflow(instanceId: string): Workflow {
  return memoryWorkflow(instanceId);
}
