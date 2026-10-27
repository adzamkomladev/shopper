import type { Queue, WorkflowLauncher } from "@shopper/ports";
import type { StatementDeliveryDeps } from "../customers";

/** What the consumer needs: the channels, the launchers the wakes start, and the queue follow-ups go back on. */
export type NotificationDeps = StatementDeliveryDeps & {
  accounts?: WorkflowLauncher;
  statements?: WorkflowLauncher;
  /** Starts the MoMo refund workflow for each `payment.refund`. */
  refunds?: WorkflowLauncher;
  queue?: Queue;
};
