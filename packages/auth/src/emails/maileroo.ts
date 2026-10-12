import * as v from "valibot";

export interface MailerooOptions {
  apiKey: string;
  from: string;
  endpoint?: string;
}
export function createMaileroo(options: MailerooOptions) {
  v.parse(v.pipe(v.string(), v.email()), options.from);
  if (!options.apiKey) throw new Error("Maileroo API key is required");
  return async (message: { email: string; subject: string; link: string }) => {
    const response = await fetch(options.endpoint ?? "https://smtp.maileroo.com/api/v2/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: { address: options.from, display_name: "Shopper" },
        to: { address: message.email },
        subject: message.subject,
        plain: `${message.subject}\n\n${message.link}\n\nIf you did not request this, ignore this email.`,
        tracking: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new MailDeliveryError();
    const result = v.safeParse(v.object({ success: v.literal(true) }), await response.json());
    if (!result.success) throw new MailDeliveryError();
  };
}
export class MailDeliveryError extends Error {
  constructor() {
    super("Email delivery failed; retry delivery");
    this.name = "MailDeliveryError";
  }
}
