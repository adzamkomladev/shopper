import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectTouchTargets } from "../targets";

// Set SHOPPER_SCREENSHOTS_DIR to keep the screenshots (docs/plans/day13/screenshots).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1366", width: 1366, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

const email = (page: Page) => page.getByRole("textbox", { name: "Username" });
const password = (page: Page) => page.getByLabel("Password");
const login = (page: Page) => page.getByRole("button", { name: /^(Login|Signing in)/ });
const open = (page: Page, query: string) => page.goto(`/harness/signin.html?${query}`);
const submits = (page: Page) => page.evaluate(() => window.signInCalls);

async function expectFits(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}

async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/signin-${name}.png` });
}

for (const size of sizes) {
  test(`idle at ${size.name}: the form is complete, focus starts on the email, nothing overflows`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page, "scenario=idle");
    await expect(page.getByRole("heading", { name: "Shopper App" })).toBeVisible();
    await expect(
      page.getByText("For security reasons please enter your username and password"),
    ).toBeVisible();
    await expect(email(page)).toBeFocused();
    await expect(password(page)).toHaveAttribute("type", "password");
    await expect(login(page)).toBeEnabled();
    await expectFits(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `idle-${size.name}`);
  });
}

test("keyboard only: type the email, Tab, type the password, Enter signs in", async ({ page }) => {
  await open(page, "scenario=idle&then=ok");
  await page.keyboard.type("ama@shop.test");
  await page.keyboard.press("Tab");
  await expect(password(page)).toBeFocused();
  await page.keyboard.type("correct horse battery");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText("Signed in");
  expect(await submits(page)).toEqual([
    { email: "ama@shop.test", password: "correct horse battery" },
  ]);
});

test("an empty or malformed form explains each field and never calls the host", async ({
  page,
}) => {
  await open(page, "scenario=idle");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Enter your email address")).toBeVisible();
  await expect(page.getByText("Enter your password")).toBeVisible();
  await expect(email(page)).toBeFocused();
  await expect(email(page)).toHaveAttribute("aria-invalid", "true");
  await expectNoSeriousAxe(page);
  await shoot(page, "invalid-1366");

  await email(page).fill("not an email");
  await password(page).fill("secret");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Enter an email address like ama@shop.com")).toBeVisible();
  await expect(email(page)).toBeFocused();
  expect(await submits(page)).toEqual([]);
});

test("signing in disables the button, names the work and ignores a second Enter", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "scenario=idle&then=slow");
  await email(page).fill("ama@shop.test");
  await password(page).fill("correct horse battery");
  await page.keyboard.press("Enter");
  await expect(login(page)).toBeDisabled();
  await expect(login(page)).toHaveText("Signing in…");
  await expect(login(page)).toHaveAttribute("aria-busy", "true");
  await page.keyboard.press("Enter");
  await expectNoSeriousAxe(page);
  await shoot(page, "signing-1366");
  await expect(page.getByRole("status")).toHaveText("Signed in");
  expect(await submits(page)).toHaveLength(1);
});

test("the signing-in state renders on load", async ({ page }) => {
  await open(page, "scenario=signing");
  await expect(login(page)).toBeDisabled();
  await expect(email(page)).toHaveJSProperty("readOnly", true);
});

const failures = [
  ["INVALID_CREDENTIALS", "Wrong email or password", "Check them and try again."],
  ["SIGN_IN_LOCKED", "Sign-in is locked", "Too many attempts. Try again in 15 minutes."],
  [
    "OFFLINE_UNAVAILABLE",
    "Connect to the internet to sign in",
    "This register has no recent sign-in for that email.",
  ],
  [
    "DEVICE_REJECTED",
    "This register needs to be enrolled again",
    "Ask a manager to enrol this register again from the portal.",
  ],
  ["SIGN_IN_UNAVAILABLE", "Sign-in is unavailable", "Sign-in is unavailable. Try again."],
] as const;

for (const [code, title, detail] of failures) {
  for (const size of [sizes[2], sizes[4]]) {
    test(`${code} at ${size.name}: says what happened and keeps the email`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page, `scenario=idle&then=${code}`);
      await email(page).fill("ama@shop.test");
      await password(page).fill("wrong password");
      await page.keyboard.press("Enter");
      const alert = page.getByRole("alert");
      await expect(alert).toContainText(title);
      await expect(alert).toContainText(detail);
      await expect(email(page)).toHaveValue("ama@shop.test");
      await expect(password(page)).toHaveValue("");
      await expect(password(page)).toBeFocused();
      await expect(login(page)).toBeEnabled();
      await expectFits(page);
      await expectNoSeriousAxe(page);
      await shoot(page, `${code.toLowerCase().replaceAll("_", "-")}-${size.name}`);
    });
  }
}

test("offline: the register says so and still lets a known cashier sign in", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "scenario=offline&then=ok");
  const notice = page.getByRole("status").filter({ hasText: "You are offline" });
  await expect(notice).toContainText("signed in on this register in the last 7 days");
  await expect(login(page)).toBeEnabled();
  await expectNoSeriousAxe(page);
  await shoot(page, "offline-1366");
  await email(page).fill("ama@shop.test");
  await password(page).fill("correct horse battery");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Signed in" })).toBeVisible();
});

test("host unreachable: Login is off and Reconnect (Alt+C) tries again", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "scenario=HOST_UNREACHABLE");
  await expect(page.getByRole("alert")).toContainText("Cannot reach the register host");
  await expect(login(page)).toBeDisabled();
  await expectFits(page);
  await expectNoSeriousAxe(page);
  await shoot(page, "unreachable-390");
  await page.keyboard.press("Alt+C");
  await page.getByRole("button", { name: /^Reconnect/ }).click();
  expect(await page.evaluate(() => window.reconnects)).toBe(2);
});
