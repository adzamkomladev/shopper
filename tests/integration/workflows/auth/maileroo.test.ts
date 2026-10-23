import { expect, test } from "vite-plus/test";
import { createMaileroo } from "@shopper/auth";
import { mail } from "../../../support/workflows/auth";

test("the real Maileroo client sends authenticated plain text email without tracking", async () => {
  const start = mail.requests.length;
  await createMaileroo({
    apiKey: mail.apiKey,
    from: "noreply@shopper.test",
    endpoint: mail.endpoint,
  })({
    email: "owner@example.com",
    subject: "Verify your Shopper email",
    link: "http://shopper.local/verify-registration?id=123&token=capability",
  });
  expect(mail.requests[start]).toEqual({
    from: { address: "noreply@shopper.test", display_name: "Shopper" },
    to: { address: "owner@example.com" },
    subject: "Verify your Shopper email",
    plain:
      "Verify your Shopper email\n\nhttp://shopper.local/verify-registration?id=123&token=capability\n\nIf you did not request this, ignore this email.",
    tracking: false,
  });
});
test("Maileroo authentication, HTTP errors and unsuccessful provider responses reject delivery", async () => {
  const send = createMaileroo({
    apiKey: mail.apiKey,
    from: "noreply@shopper.test",
    endpoint: mail.endpoint,
  });
  const message = {
    email: "owner@example.com",
    subject: "Verify",
    link: "http://shopper.local/verify",
  };
  await expect(
    createMaileroo({ apiKey: "invalid", from: "noreply@shopper.test", endpoint: mail.endpoint })(
      message,
    ),
  ).rejects.toThrow("delivery failed");
  mail.responses.push(
    { status: 503, body: { success: false } },
    { status: 200, body: { success: false } },
  );
  await expect(send(message)).rejects.toThrow("delivery failed");
  await expect(send(message)).rejects.toThrow("delivery failed");
});

test("the local Maileroo failure endpoint rejects invalid counts and fails only the requested sends", async () => {
  const endpoint = new URL("/failures", mail.endpoint);
  const setFailures = (count: number) =>
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count }),
    });
  expect((await setFailures(-1)).status).toBe(400);
  expect((await setFailures(1)).status).toBe(200);
  const send = createMaileroo({
    apiKey: mail.apiKey,
    from: "noreply@shopper.test",
    endpoint: mail.endpoint,
  });
  const message = {
    email: "failure@example.com",
    subject: "Verify",
    link: "http://shopper.local/verify",
  };
  await expect(send(message)).rejects.toThrow("delivery failed");
  await expect(send(message)).resolves.toEqual(expect.any(String));
});
