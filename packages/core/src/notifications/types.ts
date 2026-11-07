import type { Queue, Realtime, WorkflowLauncher } from "@shopper/ports";
import type { StatementDeliveryDeps } from "../customers";
import type { OrderRefundDeps } from "../orders/types";

/** What the consumer needs: the channels, the launchers the wakes start, and the queue follow-ups go back on. */
export type NotificationDeps = StatementDeliveryDeps & {
  accounts?: WorkflowLauncher;
  statements?: WorkflowLauncher;
  /** Starts the MoMo refund workflow for each `payment.refund`. */
  refunds?: WorkflowLauncher;
  /** Woken by `onboarding.event` once a shop's first product or sale commits. */
  onboarding?: WorkflowLauncher;
  /** Started, or woken, by each `kyb.notice` that moves a business verification on. */
  kyb?: WorkflowLauncher;
  /** Sends the refunds owed to payers whose payment could not keep their order. */
  orderRefunds?: OrderRefundDeps;
  queue?: Queue;
  /** The customer shop's public origin, for the links in a shopper's texts; without it they carry none. */
  shopUrl?: string;
  /** The store hubs: an accepted order due for picking is announced on its store's channel. */
  realtime?: Realtime;
};
