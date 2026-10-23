import type { WorkflowLauncher } from "@shopper/ports";
import type { StatementDeliveryDeps } from "../customers";

/** What the consumer needs: the channels, and the account workflow launcher that the wakes start. */
export type NotificationDeps = StatementDeliveryDeps & { accounts?: WorkflowLauncher };
