import { expect, type APIRequestContext } from "@playwright/test";

export const MAIL_URL = "http://127.0.0.1:3103";

type Message = { to: { address: string }; subject: string; plain: string };

async function messages(request: APIRequestContext, email: string) {
  const response = await request.get(`${MAIL_URL}/messages?email=${encodeURIComponent(email)}`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as Message[];
}

/** The capability link in the nth email sent to `email` (the link is the second paragraph). */
export async function emailedLink(request: APIRequestContext, email: string, nth = 0) {
  let found: Message | undefined;
  await expect
    .poll(async () => (found = (await messages(request, email))[nth]) !== undefined, {
      message: `an email to ${email}`,
    })
    .toBe(true);
  return new URL(found!.plain.split("\n\n")[1]!);
}

export async function mailCount(request: APIRequestContext, email: string) {
  return (await messages(request, email)).length;
}

/** The provider refuses the next email with a 500, as when it is down. Set it just before the send. */
export async function failNextMail(request: APIRequestContext) {
  const response = await request.post(`${MAIL_URL}/failures`, { data: { count: 1 } });
  expect(response.ok()).toBe(true);
}
