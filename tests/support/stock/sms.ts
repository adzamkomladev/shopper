// The Arkesel fake for the stock SMS suites, and a delivery that records how it was settled.
import { createArkesel } from "@shopper/core/sms/arkesel";
import type { Delivery, Envelope } from "@shopper/ports";
import { startArkeselFake } from "../../../tooling/arkesel/server";

export const arkesel = await startArkeselFake();
export const sms = createArkesel({
  apiKey: arkesel.apiKey,
  sender: "Shopper",
  baseUrl: arkesel.baseUrl,
});

export function recordedDelivery(message: Envelope, attempts = 1) {
  const settled: ("ack" | "retry")[] = [];
  const delivery: Delivery = {
    message,
    attempts,
    ack: async () => void settled.push("ack"),
    retry: async () => void settled.push("retry"),
  };
  return { delivery, settled };
}
