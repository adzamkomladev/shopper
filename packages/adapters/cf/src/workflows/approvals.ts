import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runApproval } from "@shopper/core/approvals";
import type { Json } from "@shopper/ports";
import type { StoreHub } from "../coordination";
import { hyperdriveDatabase } from "../database";
import { cloudflareRealtime } from "../realtime";
import { cloudflareFlow } from "./flow";

interface ApprovalEnvironment {
  HYPERDRIVE: Hyperdrive;
  STORE_HUB: DurableObjectNamespace<StoreHub>;
}

/** Cloudflare shell for a remote manager approval (instance id = approval id); the answer reaches the till live. */
export class ApprovalWorkflow extends WorkflowEntrypoint<ApprovalEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runApproval(
      cloudflareFlow(event, step),
      {
        withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE),
        realtime: cloudflareRealtime(this.env.STORE_HUB),
        appVersion: buildInfo.version,
      },
      event.payload,
    );
  }
}
