import type { Turnstile } from "@shopper/api";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Turnstile's server check: the token is good once, for the address that solved it. Any failure says no. */
export function cloudflareTurnstile(secret: string, fetcher: typeof fetch = fetch): Turnstile {
  return async (token, clientIP) => {
    if (!token) return false;
    const form = new FormData();
    form.set("secret", secret);
    form.set("response", token);
    if (clientIP) form.set("remoteip", clientIP);
    const response = await fetcher(SITEVERIFY, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
    const outcome = (await response?.json().catch(() => undefined)) as
      | { success?: unknown }
      | undefined;
    return outcome?.success === true;
  };
}
