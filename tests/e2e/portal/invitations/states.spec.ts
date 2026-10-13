import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";
import {
  collectConsole,
  navigateWithinApp,
  NEW_PASSWORD,
  shoot,
} from "../../../support/publicauth/flow";
import { emailedLink } from "../../../support/publicauth/mail";
import { invite, invitationAction, unique, type NewShop } from "../../../support/publicauth/shop";
import { expireLink } from "../../../support/publicauth/expiry";
import { createInvitationFixture } from "../../../support/publicauth/shop";

// One shop for the file: creating a shop costs a full public rate-limit window.
let shop: NewShop;
let cashierRole: string;
// The owner's session lives in this context for the whole file; each test's own `request` has none.
let owner: APIRequestContext;
test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120_000);
  ({ owner, shop, cashierRole } = await createInvitationFixture(playwright.request));
});
test.afterAll(() => owner?.dispose());

const staff = () => `staff-${unique()}@shop.example.com`;
const relative = (link: string | URL) => {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
};
const joinHeading = (page: Page) => page.getByRole("heading", { name: `Join ${shop.name}` });
const brokenHeading = (page: Page) =>
  page.getByRole("heading", { name: "This invitation link doesn't work" });

async function emailInvite(request: APIRequestContext, email: string, roleId = cashierRole) {
  await invite(owner, shop, { email, roleId, channel: "email" });
  return relative(await emailedLink(request, email));
}

test("cancelled, replaced and tampered links say they don't work and point to the owner", async ({
  page,
}, info) => {
  const cancelled = await invite(owner, shop, {
    email: staff(),
    roleId: cashierRole,
    channel: "local",
  });
  await invitationAction(owner, shop, cancelled.id, "cancel");
  await page.goto(relative(cancelled.setupLink!));
  await expect(brokenHeading(page)).toBeVisible();
  await expect(page.getByText(/ask .* to send a new invitation/i)).toBeVisible();
  await shoot(page, info, "invitation-cancelled");

  const replaced = await invite(owner, shop, {
    email: staff(),
    roleId: cashierRole,
    channel: "local",
  });
  const fresh = await invitationAction(owner, shop, replaced.id, "reissue");
  await page.goto(relative(replaced.setupLink!));
  await expect(brokenHeading(page)).toBeVisible();
  await shoot(page, info, "invitation-replaced");
  await page.goto(relative(fresh.setupLink!));
  await expect(joinHeading(page)).toBeVisible();

  const url = new URL(fresh.setupLink!);
  url.searchParams.set("token", "0".repeat(64));
  await page.goto(relative(url));
  await expect(brokenHeading(page)).toBeVisible();
  await page.goto("/accept-invitation");
  await expect(brokenHeading(page)).toBeVisible();
});

test("a password under 12 characters is refused and offline says the server can't be reached", async ({
  page,
  request,
  context,
}, info) => {
  await page.goto(await emailInvite(request, staff()));
  await page.getByLabel("Your name").fill("Short Pass");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account and join" }).click();
  await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Password")).toHaveAccessibleDescription(/at least 12/i);
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Create account and join" }).click();
  await expect(page.getByRole("alert")).toContainText(/can't reach the server/i);
  await shoot(page, info, "invitation-offline");
});

test("an unreadable reply is reported without putting the link's token in the console", async ({
  page,
}, info) => {
  const link = await invite(owner, shop, { email: staff(), roleId: cashierRole, channel: "local" });
  const token = new URL(link.setupLink!).searchParams.get("token")!;
  const lines = collectConsole(page);
  // The real API never answers 200 with the wrong shape, so this one reply is faked.
  await page.route("**/api/invitations/*/preview*", (route) =>
    route.fulfill({ status: 200, json: { unexpected: true } }),
  );
  await page.goto(relative(link.setupLink!));
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(lines.filter((line) => line.includes("[api]"))).not.toEqual([]);
  expect(lines.filter((line) => line.includes(token))).toEqual([]);
  await shoot(page, info, "invitation-server-error");
});

test("the invitation screens have no serious axe violations and render at three sizes", async ({
  page,
}, info) => {
  const link = await invite(owner, shop, { email: staff(), roleId: cashierRole, channel: "local" });
  await page.goto(relative(link.setupLink!));
  await expect(joinHeading(page)).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "accept-invitation");
  await page.goto("/accept-invitation?id=x&token=y");
  await expect(brokenHeading(page)).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "accept-invitation-broken");
});

test("SPA navigation rechecks changed credentials and a cancelled invitation", async ({ page }) => {
  const link = await invite(owner, shop, { email: staff(), roleId: cashierRole, channel: "local" });
  await page.goto(relative(link.setupLink!));
  await expect(joinHeading(page)).toBeVisible();
  const invalid = new URL(link.setupLink!);
  invalid.searchParams.set("token", "0".repeat(64));
  await navigateWithinApp(page, relative(invalid));
  await expect(brokenHeading(page)).toBeVisible();
  await navigateWithinApp(page, relative(link.setupLink!));
  await expect(joinHeading(page)).toBeVisible();
  await invitationAction(owner, shop, link.id, "cancel");
  await navigateWithinApp(page, "/login");
  await expect(page.getByRole("heading", { name: "Log in to Shopper" })).toBeVisible();
  await navigateWithinApp(page, relative(link.setupLink!));
  await expect(brokenHeading(page)).toBeVisible();
});

test("an expired invitation asks the owner for a replacement", async ({ page }, info) => {
  const link = await invite(owner, shop, { email: staff(), roleId: cashierRole, channel: "local" });
  await expireLink("invitation", link.id);
  await page.goto(relative(link.setupLink!));
  await expect(brokenHeading(page)).toBeVisible();
  await expect(page.getByText(/ask the shop owner/i)).toBeVisible();
  await shoot(page, info, "invitation-expired");
});

test("a slow real invitation preview shows the auth loading layout", async ({ page }, info) => {
  const link = await invite(owner, shop, { email: staff(), roleId: cashierRole, channel: "local" });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in to Shopper" })).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/invitations/*/preview*", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await navigateWithinApp(page, relative(link.setupLink!));
    await expect(page.getByRole("status", { name: "Loading" })).toBeVisible();
    await shoot(page, info, "invitation-loading");
  } finally {
    release();
  }
  await expect(joinHeading(page)).toBeVisible();
});
