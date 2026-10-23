import { mailAddress, mailResponse } from "../schemas/emails/maileroo";
import type { MailerooOptions, MailMessage } from "./types";
export type { MailerooOptions, MailMessage } from "./types";
import * as v from "valibot";

/** Sends one plain-text email and answers Maileroo's reference id when it gives one. */
export function createMaileroo(options: MailerooOptions) {
  v.parse(mailAddress, options.from);
  if (!options.apiKey) throw new Error("Maileroo API key is required");
  return async (message: MailMessage): Promise<string | undefined> => {
    const response = await fetch(options.endpoint ?? "https://smtp.maileroo.com/api/v2/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: { address: options.from, display_name: "Shopper" },
        to: { address: message.email },
        subject: message.subject,
        plain:
          message.plain ??
          `${message.subject}\n\n${message.link}\n\nIf you did not request this, ignore this email.`,
        tracking: false,
        ...(message.attachments?.length
          ? {
              attachments: message.attachments.map((file) => ({
                file_name: file.fileName,
                content_type: file.contentType,
                content: base64(file.content),
                inline: false,
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new MailDeliveryError();
    const result = v.safeParse(mailResponse, await response.json());
    if (!result.success) throw new MailDeliveryError();
    return result.output.data?.reference_id;
  };
}
export class MailDeliveryError extends Error {
  constructor() {
    super("Email delivery failed; retry delivery");
    this.name = "MailDeliveryError";
  }
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
