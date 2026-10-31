import * as Sentry from "@sentry/electron/main";
import { redact } from "@shopper/audit/chain";
import { buildInfo } from "@shopper/config";

// Ghana numbers in free text (0XX XXX XXXX or +233 XX XXX XXXX): only the last four leave the register.
const phone = /(?:\+?233|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}/g;

/**
 * Sentry in the main process, Crashpad included, started before anything else. The DSN is the build's
 * SHOPPER_SENTRY_DSN (an env override for tests); empty means no reporting at all. Every event goes through the
 * audit `redact()` rules by key name, then has each secret the register holds (device token, database key, bridge
 * capability) replaced and phone numbers cut to their last four. No user is attached, only the register's name.
 */
export function startCrashReporting(secrets: () => unknown[]) {
  const dsn = process.env.SHOPPER_SENTRY_DSN ?? buildInfo.sentryDsn;
  if (!dsn) return { tag() {}, report: async () => {} };
  Sentry.init({
    dsn,
    release: `shopper-register@${buildInfo.version}`,
    // The till UI is sandboxed with no preload by design; its errors are not reported from here.
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== "PreloadInjection"),
    initialScope: { tags: { channel: "stable" } },
    beforeSend: (event) => scrub(event, secrets()),
    beforeBreadcrumb: (breadcrumb) => scrub(breadcrumb, secrets()),
  });
  return {
    tag: (name: "channel" | "register", value: string) => Sentry.setTag(name, value),
    /** Sends why the register stopped and waits for it to leave, so exiting next does not drop it. */
    async report(title: string, cause: string) {
      Sentry.captureException(new Error(`${title}: ${cause}`));
      await Sentry.flush(5_000);
    },
  };
}

function scrub<T>(value: T, secrets: unknown[]): T {
  let text = JSON.stringify(redact(value));
  for (const secret of secrets)
    if (typeof secret === "string" && secret.length >= 8)
      text = text.replaceAll(secret, "[redacted]");
  return JSON.parse(text.replace(phone, (match) => `••••${match.slice(-4)}`)) as T;
}
