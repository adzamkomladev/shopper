import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runOrderPayment } from "@shopper/core/orders";
import { runMomoPayment } from "@shopper/core/payments";
import { createPaystack } from "@shopper/core/payments/paystack";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import type { StoreHub } from "../coordination";
import { cloudflareDatabase } from "../database";
import { cloudflareHubtel } from "../hubtel";
import { cloudflareLauncher } from "../launcher";
import { cloudflareQueue } from "../queue";
import { cloudflareRealtime } from "../realtime";
import { cloudflareFlow } from "./flow";
interface MomoEnvironment {
  HYPERDRIVE: Hyperdrive;
  STORE_HUB: DurableObjectNamespace<StoreHub>;
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_BASE_URL?: string;
  HUBTEL_CLIENT_ID?: string;
  HUBTEL_CLIENT_SECRET?: string;
  HUBTEL_MERCHANT_ACCOUNT?: string;
  SHOPPER_AUTH_URL?: string;
}
export class MomoPaymentWorkflow extends WorkflowEntrypoint<MomoEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runMomoPayment(
      cloudflareFlow(event, step),
      {
        withDatabase: async (run) => {
          const connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
          try {
            return await run(connection.db);
          } finally {
            await connection.close();
          }
        },
        realtime: cloudflareRealtime(this.env.STORE_HUB),
        paystack: createPaystack({
          secretKey: this.env.PAYSTACK_SECRET_KEY,
          baseUrl: this.env.PAYSTACK_BASE_URL,
        }),
        hubtel: cloudflareHubtel(this.env),
        appVersion: buildInfo.version,
      },
      event.payload,
    );
  }
}

interface OrderPaymentEnvironment {
  HYPERDRIVE: Hyperdrive;
  ORDER_FLOWS: Parameters<typeof cloudflareLauncher>[0];
  NOTIFICATIONS?: Parameters<typeof cloudflareQueue>[0];
  PAYSTACK_SECRET_KEY: string;
  PAYSTACK_BASE_URL?: string;
  HUBTEL_CLIENT_ID?: string;
  HUBTEL_CLIENT_SECRET?: string;
  HUBTEL_MERCHANT_ACCOUNT?: string;
  SHOPPER_AUTH_URL?: string;
}

/** Cloudflare shell for one attempt to pay an online order (instance id = the payment id). */
export class OrderPaymentWorkflow extends WorkflowEntrypoint<OrderPaymentEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runOrderPayment(
      cloudflareFlow(event, step),
      {
        withDatabase: async (run) => {
          const connection = await cloudflareDatabase(this.env.HYPERDRIVE.connectionString);
          try {
            return await run(connection.db);
          } finally {
            await connection.close();
          }
        },
        paystack: createPaystack({
          secretKey: this.env.PAYSTACK_SECRET_KEY,
          baseUrl: this.env.PAYSTACK_BASE_URL,
        }),
        hubtel: cloudflareHubtel(this.env),
        orders: cloudflareLauncher(this.env.ORDER_FLOWS),
        notifications: () =>
          this.env.NOTIFICATIONS
            ? cloudflareQueue(this.env.NOTIFICATIONS, NOTIFICATION_RETRY)
            : undefined,
        appVersion: buildInfo.version,
      },
      event.payload,
    );
  }
}
