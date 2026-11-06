import * as v from "valibot";
import { orderParams, runOnlineOrder, type OrderFlowDeps } from "@shopper/core/orders";
import { memoryWorkflow, workflowInstanceIdSchema, type WorkflowLauncher } from "@shopper/ports";

// shortcut: process-local waits are lost on restart (the StockHold timer still frees the stock); use Rivet Workflows
// when the box engine ships on Day 36.
export function boxOnlineOrders(deps: OrderFlowDeps): WorkflowLauncher {
  const started = new Set<string>();
  return {
    send: (id, type, payload) =>
      memoryWorkflow(v.parse(workflowInstanceIdSchema, id)).send(id, type, payload),
    async start(id, params) {
      v.parse(workflowInstanceIdSchema, id);
      v.parse(orderParams, params);
      if (started.has(id)) return;
      started.add(id);
      runOnlineOrder(memoryWorkflow(id), deps, params).catch((error: unknown) =>
        console.error({ event: "workflow.failed", instanceId: id, error }),
      );
    },
  };
}
