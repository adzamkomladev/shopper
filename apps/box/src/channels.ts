import { createMaileroo } from "@shopper/auth";
import { createArkesel } from "@shopper/core/sms/arkesel";

/** Email (Maileroo) and SMS (Arkesel) when their keys are configured; a missing channel is undefined. */
export function boxChannels(environment: Record<string, string | undefined>) {
  return {
    mail:
      environment.MAILEROO_API_KEY && environment.MAILEROO_FROM
        ? createMaileroo({
            apiKey: environment.MAILEROO_API_KEY,
            from: environment.MAILEROO_FROM,
            endpoint: environment.MAILEROO_ENDPOINT,
          })
        : undefined,
    sms: environment.ARKESEL_API_KEY
      ? createArkesel({
          apiKey: environment.ARKESEL_API_KEY,
          sender: environment.ARKESEL_SENDER ?? "Shopper",
          baseUrl: environment.ARKESEL_BASE_URL || undefined,
        })
      : undefined,
  };
}
