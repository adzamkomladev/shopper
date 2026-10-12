import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { waitForAuthSlot } from "../../../support/e2e";
import { NEW_PASSWORD, shoot } from "../../../support/publicauth/flow";
import { emailedLink, mailCount } from "../../../support/publicauth/mail";
import { invite, unique, type NewShop } from "../../../support/publicauth/shop";
import { createInvitationFixture } from "../../../support/publicauth/shop";
import { waitForPublicSlot } from "../../../support/publicauth/slots";

// One shop for the file: creating a shop costs a full public rate-limit window.
let shop: NewShop;
let cashierRole: string;
let adminRole: string;
// The owner's session lives in this context for the whole file; each test's own `request` has none.
let owner: APIRequestContext;
test.beforeAll(async ({ playwright }) => {
  test.setTimeout(120_000);
  ({ owner, shop, cashierRole, adminRole } = await createInvitationFixture(playwright.request));
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

test("a new staff member names themselves, sets a password and is signed in", async ({
  page,
  request,
}) => {
  const email = staff();
  await page.goto(await emailInvite(request, email));
  await expect(joinHeading(page)).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeFocused();
  await page.keyboard.type("Esi Cashier");
  await page.keyboard.press("Tab");
  await page.keyboard.type(NEW_PASSWORD);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products$/);
});

test("a local link works with the internet blocked, sends no email and does not verify the address", async ({
  page,
  request,
  context,
}) => {
  const email = staff();
  const link = await invite(owner, shop, { email, roleId: cashierRole, channel: "local" });
  // Only this machine is reachable: everything else, including email providers, is cut off.
  await context.route(
    (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
    (route) => route.abort("internetdisconnected"),
  );
  await page.goto(relative(link.setupLink!));
  const wan = await page.evaluate(() =>
    fetch("https://example.com/").then(
      () => "reachable",
      () => "blocked",
    ),
  );
  expect(wan).toBe("blocked");
  await expect(joinHeading(page)).toBeVisible();
  await page.getByLabel("Your name").fill("Yaw Till");
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await page.getByRole("button", { name: "Create account and join" }).click();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  // A setup link needs no provider: nothing was sent, and the address was never verified by mail.
  expect(await mailCount(request, email)).toBe(0);
});

test("an existing account signs in with its own password and keeps it", async ({
  page,
  request,
}) => {
  const email = staff();
  const first = await emailInvite(request, email);
  await page.goto(first);
  await page.getByLabel("Your name").fill("Efua Staff");
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await page.getByRole("button", { name: "Create account and join" }).click();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();

  const second = await invite(owner, shop, { email, roleId: adminRole, channel: "local" });
  await page.context().clearCookies();
  await page.goto(relative(second.setupLink!));
  await expect(page.getByText(`Sign in as ${email}`)).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await page.getByLabel("Password").fill("not-the-password-1");
  await waitForAuthSlot();
  await page.getByRole("button", { name: "Sign in and join" }).click();
  await expect(page.getByRole("alert")).toContainText(/invalid|incorrect/i);
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
});

test("a used link says it doesn't work", async ({ page }, info) => {
  const link = await invite(owner, shop, { email: staff(), roleId: cashierRole, channel: "local" });
  await page.goto(relative(link.setupLink!));
  await page.getByLabel("Your name").fill("Once Only");
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await page.getByRole("button", { name: "Create account and join" }).click();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.goto(relative(link.setupLink!));
  await expect(brokenHeading(page)).toBeVisible();
  await shoot(page, info, "invitation-consumed");
});
