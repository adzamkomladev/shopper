import { expect, test } from "@playwright/test";
import { fillSheet, sheet, tagOf } from "../../support/catalogue";
import { expectNoSeriousAxe, waitForAuthSlot } from "../../support/e2e";
import { emailedLink, mailCount } from "../../support/publicauth/mail";
import {
  newRegistration,
  NEW_PASSWORD,
  submitPassword,
  submitSignup,
  verifyFromEmail,
} from "../../support/publicauth/flow";
import { chooseByTyping } from "../../support/admin/people";
import { PUBLIC_ORIGIN, unique } from "../../support/publicauth/shop";
import { waitForPublicSlot } from "../../support/publicauth/slots";

test("a new owner signs up, verifies the emailed link and lands signed in", async ({
  page,
  request,
}) => {
  const data = newRegistration();
  await page.goto("/signup");
  await expect(page.getByLabel("Your name")).toBeFocused();
  for (const [index, value] of [data.name, data.email, data.shopName, data.shopCode].entries()) {
    if (index) await page.keyboard.press("Tab");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(value);
  }
  await waitForPublicSlot();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(data.email)).toBeVisible();

  const link = await emailedLink(request, data.email);
  await page.goto(`${link.pathname}${link.search}`);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  // Opening the link only previews it: nothing is verified until the button is pressed.
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verify email" })).toBeFocused();
  await waitForPublicSlot();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Set up your shop" })).toBeVisible();
  await expect(page.getByLabel("Password")).toBeFocused();
  await expect(page.getByLabel("Shop code")).toHaveValue(data.shopCode);

  await page.keyboard.type(NEW_PASSWORD);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.keyboard.press("Enter");
  // A new shop starts in the setup wizard.
  await expect(page).toHaveURL(/\/setup/);
});

test("a verified link opened again goes straight to the password step", async ({
  page,
  request,
}) => {
  const data = newRegistration();
  await submitSignup(page, data);
  const link = await verifyFromEmail(page, request, data);
  await page.goto(`${link.pathname}${link.search}`);
  await expect(page.getByRole("heading", { name: "Set up your shop" })).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("a taken shop code is reported on Shop code and can be corrected", async ({
  page,
  request,
}) => {
  const data = { ...newRegistration(), shopCode: "e2e-mart" };
  await submitSignup(page, data);
  await verifyFromEmail(page, request, data);
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await waitForPublicSlot();
  await page.getByRole("button", { name: "Create shop" }).click();
  const code = page.getByLabel("Shop code");
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await expect(code).toHaveAccessibleDescription(/already in use/i);
  await expect(code).toBeFocused();
  await code.fill(`kofi-${Date.now().toString(36)}`);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await page.getByRole("button", { name: "Create shop" }).click();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
});

test("the signup form names what is wrong and focuses the first field", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Shop code").fill("Bad Code!");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Your name")).toBeFocused();
  for (const label of ["Your name", "Email", "Shop name", "Shop code"])
    await expect(page.getByLabel(label)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Shop code")).toHaveAccessibleDescription(
    /lowercase letters, numbers and hyphens/i,
  );
});

test("a password under 12 characters is refused on the Password field", async ({
  page,
  request,
}) => {
  const data = newRegistration();
  await submitSignup(page, data);
  await verifyFromEmail(page, request, data);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create shop" }).click();
  await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Password")).toHaveAccessibleDescription(/at least 12/i);
});

test("Resend email sends another link and the first stays usable until it expires", async ({
  page,
  request,
}) => {
  const data = newRegistration();
  await submitSignup(page, data);
  await emailedLink(request, data.email);
  await waitForPublicSlot();
  await page.getByRole("button", { name: "Resend email" }).click();
  await expect(page.getByText(/another email is on its way/i)).toBeVisible();
  await expect.poll(() => mailCount(request, data.email)).toBe(2);
});

test("the login page offers shop creation on the cloud", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Create a shop" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("milestone: an owner sets up a shop and a cashier they invite accepts and signs in", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(240_000);
  const data = newRegistration();
  await submitSignup(page, data);
  await verifyFromEmail(page, request, data);
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  // A new shop starts in the setup wizard; this owner sets it up from the screens themselves instead.
  await expect(page.getByRole("heading", { name: "Get your shop ready", level: 1 })).toBeVisible();

  const tag = unique();
  await page.goto("/stores");
  await expect(page.getByRole("heading", { name: "Stores", level: 1 })).toBeVisible();
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.type(`Main store ${tag}`);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Store added")).toBeVisible();

  await page.goto("/branches");
  await expect(page.getByRole("heading", { name: "Branches", level: 1 })).toBeVisible();
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.type(`Osu ${tag}`);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.getByRole("option", { name: `Main store ${tag}` }).click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Branch added")).toBeVisible();

  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog")).toBeVisible();
  await fillSheet(page, { name: `Gari ${tagOf()}`, sku: `GARI-${tagOf()}` });
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText(/\bproduct (added|created)\b/i)).toBeVisible();
  await expect(sheet(page)).toBeHidden();

  // A custom role, made and then narrowed on the Roles screen.
  const roleName = `Shelf stocker ${tag}`;
  await page.goto("/roles");
  await expect(page.getByRole("heading", { name: "Roles", level: 1 })).toBeVisible();
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.type(roleName);
  await page.getByRole("dialog").getByRole("switch", { name: "View products" }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Role created")).toBeVisible();
  await page.getByRole("button", { name: `Edit permissions for ${roleName}` }).click();
  await page.getByRole("dialog").getByRole("switch", { name: "View products" }).click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Role saved")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: roleName })).toContainText("0 of");

  // The cashier is invited from the Users screen, and the email goes out to them.
  const cashier = `cashier-${tag}@shop.example.com`;
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Invite user/ })).toBeVisible();
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog")).toBeVisible();
  const invitation = page.getByRole("dialog");
  await invitation.getByLabel("Email", { exact: true }).fill(cashier);
  await chooseByTyping(page, invitation.getByRole("combobox", { name: "Role" }), "cashier");
  await chooseByTyping(page, invitation.getByRole("combobox", { name: "How to send it" }), "Email");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("row").filter({ hasText: cashier })).toBeVisible();
  const link = await emailedLink(request, cashier);

  const invitee = await browser.newContext({ baseURL: PUBLIC_ORIGIN });
  const joining = await invitee.newPage();
  await joining.goto(`${link.pathname}${link.search}`);
  await expect(joining.getByRole("heading", { name: `Join ${data.shopName}` })).toBeVisible();
  await expect(joining.getByText("cashier", { exact: true })).toBeVisible();
  await joining.getByLabel("Your name").fill("Esi Cashier");
  await joining.getByLabel("Password").fill(NEW_PASSWORD);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await joining.getByRole("button", { name: "Create account and join" }).click();
  await expect(joining.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await invitee.close();
});
