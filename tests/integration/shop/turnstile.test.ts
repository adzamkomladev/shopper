// Day 30 S3: the cloud's Turnstile check posts the secret, the token and the client address to siteverify, and
// anything but `success: true` (a refusal, an error page, a network failure) counts as a robot.
import { expect, test } from "vite-plus/test";
import { cloudflareTurnstile } from "@shopper/adapters-cf/turnstile";

const answering = (reply: () => Promise<Response>) => {
  const seen: { url: string; form: Record<string, string> }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    seen.push({ url, form: Object.fromEntries(init.body as FormData) as Record<string, string> });
    return reply();
  }) as typeof fetch;
  return { seen, fetcher };
};

test("a solved token passes, sent with the secret and the client address", async () => {
  const { seen, fetcher } = answering(async () => Response.json({ success: true }));
  expect(await cloudflareTurnstile("secret-key", fetcher)("token-1", "198.51.100.9")).toBe(true);
  expect(seen).toEqual([
    {
      url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      form: { secret: "secret-key", response: "token-1", remoteip: "198.51.100.9" },
    },
  ]);
});

test("a refusal, a broken reply, a network failure or no token at all is a no", async () => {
  const refused = answering(async () => Response.json({ success: false }));
  expect(await cloudflareTurnstile("s", refused.fetcher)("t")).toBe(false);
  const broken = answering(async () => new Response("<html>", { status: 502 }));
  expect(await cloudflareTurnstile("s", broken.fetcher)("t")).toBe(false);
  const down = answering(async () => Promise.reject(new TypeError("fetch failed")));
  expect(await cloudflareTurnstile("s", down.fetcher)("t")).toBe(false);
  const empty = answering(async () => Response.json({ success: true }));
  expect(await cloudflareTurnstile("s", empty.fetcher)("")).toBe(false);
  expect(empty.seen).toEqual([]);
});
