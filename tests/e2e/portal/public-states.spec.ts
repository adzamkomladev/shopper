import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";
import {
  collectConsole,
  navigateWithinApp,
  newRegistration,
  shoot,
  submitPassword,
  submitSignup,
  verifyFromEmail,
} from "../../support/publicauth/flow";
import { emailedLink, failNextMail } from "../../support/publicauth/mail";
import { expireLink } from "../../support/publicauth/expiry";
import { waitForPublicSlot } from "../../support/publicauth/slots";

const brokenHeading = (page: import("@playwright/test").Page) =>
  page.getByRole("heading", { name: "This verification link doesn't work" });

test("a tampered, incomplete or malformed verification link says it doesn't work", async ({
  page,
  request,
}) => {
  const data = newRegistration();
  await submitSignup(page, data);
  const link = await emailedLink(request, data.email);
  link.searchParams.set("token", "f".repeat(64));
  await page.goto(`${link.pathname}${link.search}`);
  await expect(brokenHeading(page)).toBeVisible();
  await page.getByRole("link", { name: "Start again" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.goto("/verify-registration");
  await expect(brokenHeading(page)).toBeVisible();
  await page.goto("/verify-registration?id=not-an-id&token=x");
  await expect(brokenHeading(page)).toBeVisible();
});

test("a finished registration's link says the shop is already set up and offers Log in", async ({
  page,
  request,
}, info) => {
  const data = newRegistration();
  await submitSignup(page, data);
  const link = await verifyFromEmail(page, request, data);
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.goto(`${link.pathname}${link.search}`);
  await expect(page.getByRole("heading", { name: "Your shop is already set up" })).toBeVisible();
  await shoot(page, info, "verify-completed");
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp(`/login\\?shop=${data.shopCode}$`));
  await expect(page.getByLabel("Shop code")).toHaveValue(data.shopCode);
});

test("offline: sign-up says the server can't be reached and keeps what was typed", async ({
  page,
  context,
}, info) => {
  const data = newRegistration();
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(data.name);
  await page.getByLabel("Email").fill(data.email);
  await page.getByLabel("Shop name").fill(data.shopName);
  await page.getByLabel("Shop code").fill(data.shopCode);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText(/can't reach the server/i);
  await expect(page.getByLabel("Email")).toHaveValue(data.email);
  await shoot(page, info, "signup-offline");
});

test("a failed email is reported, and Resend email delivers it", async ({
  page,
  request,
}, info) => {
  await failNextMail(request);
  const data = newRegistration();
  await submitSignup(page, data);
  const failed = page.getByText(/couldn't send the email/i);
  await expect(async () => {
    await page.getByRole("button", { name: "Check delivery" }).click();
    await expect(failed).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await shoot(page, info, "check-email-failed");
  await waitForPublicSlot();
  await page.getByRole("button", { name: "Resend email" }).click();
  await expect(async () => {
    await page.getByRole("button", { name: "Check delivery" }).click();
    await expect(page.getByText("The email was sent.")).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await expect(failed).toBeHidden();
  const link = await emailedLink(request, data.email, 1);
  expect(link.pathname).toBe("/verify-registration");
});

test("offline: a verification link says the server can't be reached, never logs its token, and Try again recovers", async ({
  page,
  request,
  context,
}, info) => {
  const data = newRegistration();
  await submitSignup(page, data);
  const link = await emailedLink(request, data.email);
  const token = link.searchParams.get("token")!;
  const lines = collectConsole(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in to Shopper", exact: true })).toBeVisible();
  await context.setOffline(true);
  // A client-side navigation, as a link inside the app would do: the app is loaded, the network is not.
  await navigateWithinApp(page, `${link.pathname}${link.search}`);
  await expect(page.getByRole("heading", { name: "Can't reach the server" })).toBeVisible();
  expect(lines.filter((line) => line.includes("[api]"))).not.toEqual([]);
  expect(lines.filter((line) => line.includes(token))).toEqual([]);
  await expectNoSeriousAxe(page);
  await shoot(page, info, "verify-offline");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  expect(lines.filter((line) => line.includes(token))).toEqual([]);
});

test("the registration screens have no serious axe violations and render at three sizes", async ({
  page,
  request,
}, info) => {
  const data = newRegistration();
  await page.goto("/signup");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "signup");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
  await expectNoSeriousAxe(page);
  await shoot(page, info, "signup-errors");
  await page.setViewportSize({ width: 1440, height: 900 });
  await submitSignup(page, data);
  await expectNoSeriousAxe(page);
  await shoot(page, info, "check-email");
  const link = await emailedLink(request, data.email);
  await page.goto(`${link.pathname}${link.search}`);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "verify-email");
  await waitForPublicSlot();
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByRole("heading", { name: "Set up your shop" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.goto(`${link.pathname}${link.search}`);
  await expect(page.getByRole("heading", { name: "Set up your shop" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "set-up-shop");
  await page.goto("/verify-registration");
  await expectNoSeriousAxe(page);
  await shoot(page, info, "verify-broken");
});

test("public diagnostics never echo capabilities reflected by an unreadable server", async ({
  page,
  request,
}, info) => {
  const data = newRegistration();
  await submitSignup(page, data);
  const link = await emailedLink(request, data.email);
  const token = link.searchParams.get("token")!;
  const lines = collectConsole(page);
  await page.route("**/api/onboarding/*?token=*", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/plain",
      body: `upstream failed for token=${token}`,
    }),
  );
  await page.goto(`${link.pathname}${link.search}`);
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  expect(lines.filter((line) => line.includes("[api]"))).not.toEqual([]);
  expect(lines.some((line) => line.includes(token))).toBe(false);
  await expectNoSeriousAxe(page);
  await shoot(page, info, "verify-server-error");
  // A well-formed upstream error may also echo a request credential.
  await page.unroute("**/api/onboarding/*?token=*");
  await page.route("**/api/onboarding/*?token=*", (route) =>
    route.fulfill({
      status: 502,
      json: { error: `upstream rejected token=${token}` },
    }),
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => lines.some((line) => line.includes("upstream rejected"))).toBe(true);
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  expect(lines.some((line) => line.includes(token))).toBe(false);
});

test("an expired verification link offers a fresh signup", async ({ page, request }, info) => {
  const data = newRegistration();
  await submitSignup(page, data);
  const link = await emailedLink(request, data.email);
  await expireLink("registration_request", link.searchParams.get("id")!);
  await page.goto(`${link.pathname}${link.search}`);
  await expect(brokenHeading(page)).toBeVisible();
  await expect(page.getByRole("link", { name: "Start again" })).toBeVisible();
  await shoot(page, info, "verify-expired");
});

test("a slow real verification preview shows the auth loading layout", async ({
  page,
  request,
}, info) => {
  const data = newRegistration();
  await submitSignup(page, data);
  const link = await emailedLink(request, data.email);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in to Shopper" })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/onboarding/*?token=*", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await navigateWithinApp(page, `${link.pathname}${link.search}`);
    await expect(page.getByRole("status", { name: "Loading" })).toBeVisible();
    await expectNoSeriousAxe(page);
    await shoot(page, info, "verify-loading");
  } finally {
    release();
  }
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
});
