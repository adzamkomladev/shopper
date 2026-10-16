import { and, eq } from "drizzle-orm";
import { paymentIntent, type TillDatabase } from "@shopper/db-sqlite";
import type { HostConfiguration } from "../config";

export async function readHostPayment(
  database: TillDatabase,
  config: HostConfiguration,
  reference: string,
) {
  const session = config.session;
  if (!session) return undefined;
  return database.read(
    async (tx) =>
      (
        await tx
          .select()
          .from(paymentIntent)
          .where(
            and(
              eq(paymentIntent.orgId, config.identity.orgId),
              eq(paymentIntent.reference, reference),
              eq(paymentIntent.deviceId, config.identity.deviceId),
              eq(paymentIntent.cashierId, session.userId),
            ),
          )
      )[0],
  );
}
