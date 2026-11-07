import * as v from "valibot";
import {
  orderParams,
  orderPaymentParams,
  reviewInstanceId,
  runOnlineOrder,
  runOrderPayment,
  runOrderReview,
  type OrderFlowDeps,
  type OrderPaymentDeps,
  type ReviewFlowDeps,
} from "@shopper/core/orders";
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

// shortcut: process-local waits are lost on restart (an attempt is then settled by its webhook or the hold timer);
// use Rivet Workflows when the box engine ships on Day 36.
export function boxOrderPayments(deps: OrderPaymentDeps): WorkflowLauncher {
  const started = new Set<string>();
  return {
    send: (id, type, payload) =>
      memoryWorkflow(v.parse(workflowInstanceIdSchema, id)).send(id, type, payload),
    async start(id, params) {
      v.parse(workflowInstanceIdSchema, id);
      v.parse(orderPaymentParams, params);
      if (started.has(id)) return;
      started.add(id);
      runOrderPayment(memoryWorkflow(id), deps, params).catch((error: unknown) =>
        console.error({ event: "workflow.failed", instanceId: id, error }),
      );
    },
  };
}

// shortcut: process-local waits and the 48 hour sleep are lost on restart; use Rivet Workflows when the box engine
// ships on Day 36 (a restart then loses only the request to review, never an order).
export function boxOrderReviews(deps: ReviewFlowDeps): WorkflowLauncher {
  const started = new Set<string>();
  return {
    send: (id, type, payload) =>
      memoryWorkflow(v.parse(workflowInstanceIdSchema, id)).send(id, type, payload),
    async start(id, params) {
      v.parse(workflowInstanceIdSchema, id);
      const { id: orderId } = v.parse(orderParams, params);
      if (id !== reviewInstanceId(orderId) || started.has(id)) return;
      started.add(id);
      runOrderReview(memoryWorkflow(id), deps, params).catch((error: unknown) =>
        console.error({ event: "workflow.failed", instanceId: id, error }),
      );
    },
  };
}
