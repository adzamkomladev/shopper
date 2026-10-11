import { expect, test, type Page } from "@playwright/test";
import {
  ANNEX,
  expectNoSeriousAxe,
  MART,
  OWNER_NAME,
  signInWithKeyboard,
  typeCredentials,
} from "../../support/e2e";

test.use({ storageState: { cookies: [], origins: [] } });

async function signOut(page: Page) {
  await page.getByRole("button", { name: OWNER_NAME }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

test("keyboard-only sign-in lands on products", async ({ page }) => {
  await signInWithKeyboard(page, MART);
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
});

test("an unknown shop code is reported on the Shop code field", async ({ page }) => {
  await typeCredentials(page, { ...MART, code: "no-such-shop" });
  const field = page.getByLabel("Shop code");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(/\S/);
  await expect(page).toHaveURL(/\/login/);
});

test("a wrong password keeps the shop code and shows a form error", async ({ page }) => {
  await typeCredentials(page, MART, "not-the-password-1");
  await expect(page.getByRole("alert")).toContainText(/invalid|incorrect/i);
  await expect(page.getByLabel("Shop code")).toHaveValue(MART.code);
  await expect(page.getByLabel("Shop code")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/login/);
});

test("sign out returns to login with the shop code prefilled", async ({ page }) => {
  await signInWithKeyboard(page, MART);
  await signOut(page);
  await expect(page.getByLabel("Shop code")).toHaveValue(MART.code);
});

test("the shop switcher lists remembered shops and opens login for the other one", async ({
  page,
}) => {
  await signInWithKeyboard(page, MART);
  await signOut(page);
  await signInWithKeyboard(page, ANNEX);
  await page.getByRole("navigation").getByRole("combobox").click();
  await expect(page.getByRole("option", { name: MART.name })).toBeVisible();
  await expect(page.getByRole("option", { name: ANNEX.name })).toBeVisible();
  await page.getByRole("option", { name: MART.name }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Shop code")).toHaveValue(MART.code);
});

test("submitting an empty form focuses the first field that needs attention", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").focus();
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByLabel("Shop code")).toBeFocused();
  await expect(page.getByLabel("Shop code")).toHaveAttribute("aria-invalid", "true");
});

test("signing in offline says the server can't be reached", async ({ page, context }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Shop code")).toBeFocused();
  await page.getByLabel("Shop code").fill(MART.code);
  await page.getByLabel("Email").fill(MART.email);
  await page.getByLabel("Password").fill("any-password-1");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toContainText(/can't reach the server/i);
});

test("login has no serious axe violations and renders at three sizes", async ({ page }, info) => {
  await page.goto("/login");
  await expect(page.getByLabel("Shop code")).toBeVisible();
  await expectNoSeriousAxe(page);
  for (const [width, height] of [
    [1366, 768],
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    const path = info.outputPath(`login-${width}x${height}.png`);
    await page.screenshot({ path, fullPage: true });
    await info.attach(`login-${width}x${height}`, { path, contentType: "image/png" });
  }
});
