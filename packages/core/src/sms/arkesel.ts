import * as v from "valibot";
import { sendReplySchema } from "./schemas/arkesel";
import type { ArkeselOptions } from "./types";

export class ArkeselError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ArkeselError";
  }
}

/** Arkesel wants international numbers without the plus: 0241234567 becomes 233241234567. */
const international = (phone: string) => phone.replace(/^\+/, "").replace(/^0/, "233");

export function createArkesel({
  apiKey,
  sender,
  baseUrl = "https://sms.arkesel.com",
  fetch: fetcher = fetch,
}: ArkeselOptions) {
  return {
    /** Sends one message and answers Arkesel's id for the first recipient, when it gives one. */
    async send(recipients: string[], message: string): Promise<string | undefined> {
      const response = await fetcher(`${baseUrl}/api/v2/sms/send`, {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({ sender, message, recipients: recipients.map(international) }),
        signal: AbortSignal.timeout(10_000),
      });
      const reply = v.safeParse(sendReplySchema, await response.json().catch(() => undefined));
      if (!response.ok || !reply.success || reply.output.status !== "success")
        throw new ArkeselError(
          (reply.success && reply.output.message) || `Arkesel replied ${response.status}`,
          response.status,
        );
      const [first] = Array.isArray(reply.output.data) ? reply.output.data : [];
      return typeof first?.id === "string" ? first.id : undefined;
    },
  };
}
