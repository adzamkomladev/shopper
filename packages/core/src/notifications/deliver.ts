import * as v from "valibot";
import type { Delivery } from "@shopper/ports";
import { refundMessage } from "../payments/schemas/refunds";
import {
  deliverAccountMessage,
  deliverSchedule,
  deliverStatement,
  deliverTierNotice,
} from "../customers";
import { deliverStockAlert } from "../stock";
import { deliverAuditAnchor } from "../audit/anchor";
import { deliverStoreDayReminder, deliverStoreDaySummary } from "../reports/day/deliver";
import { deliverApprovalRequest } from "../approvals/deliver";
import { deliverReceiptEmail } from "../receipts/email/deliver";
import { deliverInvoiceEmail } from "../billing/deliver";
import type { NotificationDeps } from "./types";
export type { NotificationDeps } from "./types";

/**
 * The notification queue's one consumer: each message type goes to its own delivery. A channel the shell has no
 * credentials for retries, and dead-letters, rather than dropping the message.
 */
export async function deliverNotification(deps: NotificationDeps, delivery: Delivery) {
  switch (delivery.message.type) {
    case "stock.low":
      if (!deps.sms) return await delivery.retry();
      return await deliverStockAlert(deps.db, deps.sms, delivery, deps.appVersion);
    case "statement.send":
      return await deliverStatement(deps, delivery);
    case "tier.notice":
      return await deliverTierNotice(deps, delivery);
    case "account.wake":
    case "account.settings":
      return await deliverAccountMessage(deps, delivery);
    case "statement.schedule":
    case "statement.scheduled":
      return await deliverSchedule(deps, delivery);
    case "audit.anchor":
      return await deliverAuditAnchor(deps, delivery);
    case "store-day.reminder":
      return await deliverStoreDayReminder(deps, delivery);
    case "store-day.summary":
      return await deliverStoreDaySummary(deps, delivery);
    case "payment.refund":
      return await startRefund(deps, delivery);
    case "approval.requested":
      return await deliverApprovalRequest(deps, delivery);
    case "receipt.email":
      return await deliverReceiptEmail(deps, delivery);
    case "invoice.issued":
    case "invoice.reminder":
    case "invoice.read_only":
      return await deliverInvoiceEmail(deps, delivery);
    default:
      console.error({ event: "notification.unknown_type", type: delivery.message.type });
      return await delivery.retry();
  }
}

async function startRefund(deps: NotificationDeps, delivery: Delivery) {
  if (!deps.refunds) return await delivery.retry();
  const { id } = v.parse(refundMessage, delivery.message.payload);
  // Starting an id that exists does nothing, so a redelivered message never refunds twice.
  await deps.refunds.start(id, { orgId: delivery.message.orgId, id });
  await delivery.ack();
}
