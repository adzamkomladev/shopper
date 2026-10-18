// The sign-in screen and the shell against a real register host that signs staff in against a stub server.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { ama, esi, kofi, startSignInScenario } from "../../../../support/till/session/scenario";

const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
let scenario: Awaited<ReturnType<typeof startSignInScenario>> | undefined;

test.beforeEach(async ({ baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  scenario = await startSignInScenario(new URL(baseURL).origin);
});
test.afterEach(async () => scenario?.stop());

const email = (page: Page) => page.getByRole("textbox", { name: "Username" });
const password = (page: Page) => page.getByLabel("Password");

async function open(page: Page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(scenario!.url);
  await expect(email(page)).toBeFocused();
}

async function signInWithKeyboard(page: Page, who: { email: string; password: string }) {
  await page.keyboard.type(who.email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(who.password);
  await page.keyboard.press("Enter");
}

test("a cashier signs in with the keyboard and lands on Checkout", async ({ page }) => {
  await open(page);
  await expectNoSeriousAxe(page);
  await signInWithKeyboard(page, kofi);
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
  await expect(page.getByText("Kofi Boateng ·")).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Register sections" }).getByRole("tab"),
  ).toHaveText([/Checkout/]);
  await expect(page.getByRole("combobox")).toBeFocused();
  await expectNoSeriousAxe(page);
  if (shots) {
    mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: `${shots}/shell-live-checkout-1366.png` });
  }
});

test("a signed-in user without sale.create lands on Dashboard and sees only their tabs", async ({
  page,
}) => {
  await open(page);
  await signInWithKeyboard(page, esi);
  await expect(page.locator('[data-slot="register-dashboard"]')).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Register sections" }).getByRole("tab"),
  ).toHaveText([/Dashboard/, /Inventory/, /Sales Reports/]);
});

test("a wrong password says so, and Sign out returns to the login form", async ({ page }) => {
  await open(page);
  await signInWithKeyboard(page, { email: ama.email, password: "wrong password" });
  await expect(page.getByRole("alert")).toContainText("Wrong email or password");
  await expect(password(page)).toBeFocused();
  await expect(email(page)).toHaveValue(ama.email);

  await page.keyboard.type(ama.password);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();

  await page.keyboard.press("Control+M");
  await page
    .getByRole("dialog", { name: "Menu" })
    .getByRole("button", { name: /^Sign out/ })
    .click();
  await expect(email(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toHaveCount(0);
  expect(await scenario!.user()).toBeNull();
});

test("a locked server login is explained and the form stays usable", async ({ page }) => {
  scenario!.staff.state.mode = "locked";
  await open(page);
  await signInWithKeyboard(page, ama);
  await expect(page.getByRole("alert")).toContainText("Sign-in is locked");
  await expect(page.getByRole("alert")).toContainText("Too many attempts");
  await expect(page.getByRole("button", { name: "Login" })).toBeEnabled();
});

test("an unreachable server signs a known cashier in offline and says so in the status bar", async ({
  page,
}) => {
  await open(page);
  await signInWithKeyboard(page, ama);
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
  await page.keyboard.press("Control+M");
  await page
    .getByRole("dialog", { name: "Menu" })
    .getByRole("button", { name: /^Sign out/ })
    .click();
  await expect(email(page)).toBeVisible();

  scenario!.staff.state.mode = "down";
  await signInWithKeyboard(page, ama);
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
  await expect.poll(async () => (await scenario!.user())?.offline).toBe(true);
});
