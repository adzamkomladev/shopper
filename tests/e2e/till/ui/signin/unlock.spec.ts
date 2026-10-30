// Day 26: a locked sign-in names the time it lifts, and a manager's PIN lifts it at once (Figma 367:1758).
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectTouchTargets } from "../targets";

const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

const open = (page: Page, query = "") =>
  page.goto(`/harness/signin.html?scenario=SIGN_IN_LOCKED${query}`);
const unlockButton = (page: Page) => page.getByRole("button", { name: /Manager unlock/ });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Unlock sign-in" });
const unlocks = (page: Page) => page.evaluate(() => window.unlockCalls);

async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/signin-unlock-${name}.png` });
}

async function choose(page: Page, pin: string) {
  const manager = page.getByRole("combobox", { name: "Manager" });
  await expect(manager).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(manager).toContainText("Kofi Mensah");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Manager PIN")).toBeFocused();
  await page.keyboard.type(pin);
}

for (const size of sizes) {
  test(`locked at ${size.name}: the time it lifts, a manager unlock, nothing overflows`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page);
    await expect(page.getByRole("alert")).toContainText("Too many attempts. Try again at 14:35.");
    await expect(unlockButton(page)).toHaveAttribute("aria-keyshortcuts", "Control+U Meta+U");
    await shoot(page, `locked-${size.name}`);
    await unlockButton(page).click();
    await expect(dialog(page)).toContainText("ama@example.com");
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      size.width,
    );
    await shoot(page, `dialog-${size.name}`);
  });
}

test("keyboard only: Ctrl+U, choose the manager, a wrong PIN is refused, the right one unlocks", async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press("Control+u");
  await expect(dialog(page)).toBeVisible();
  await choose(page, "0000");
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByText("Wrong PIN")).toBeVisible();
  await expect(page.getByLabel("Manager PIN")).toBeFocused();
  await expect(page.getByLabel("Manager PIN")).toHaveValue("");
  await shoot(page, "wrong-pin");

  await page.keyboard.type("4321");
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText("Sign-in is locked")).toHaveCount(0);
  expect(await unlocks(page)).toEqual([
    {
      email: "ama@example.com",
      approval: { approverId: "10000000-0000-7000-8000-000000000020", pin: "0000" },
    },
    {
      email: "ama@example.com",
      approval: { approverId: "10000000-0000-7000-8000-000000000020", pin: "4321" },
    },
  ]);
  await expect(page.getByRole("textbox", { name: "Username" })).toBeFocused();
});

test("Escape closes the dialog without unlocking", async ({ page }) => {
  await open(page);
  await unlockButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(unlockButton(page)).toBeFocused();
  await expect(page.getByText("Sign-in is locked")).toBeVisible();
  expect(await unlocks(page)).toEqual([]);
});

test("managers that cannot load offer a retry; none on file says to connect", async ({ page }) => {
  await open(page, "&approvers=failed");
  await unlockButton(page).click();
  await expect(dialog(page)).toContainText("Managers could not be loaded.");
  await expect(dialog(page).getByRole("button", { name: /^Unlock/ })).toBeDisabled();
  await shoot(page, "approvers-failed");

  await open(page, "&approvers=none");
  await unlockButton(page).click();
  await expect(dialog(page)).toContainText("Connect to load manager approvals");
});

test("other failures offer no manager unlock", async ({ page }) => {
  await page.goto("/harness/signin.html?scenario=INVALID_CREDENTIALS");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(unlockButton(page)).toHaveCount(0);
  await page.keyboard.press("Control+u");
  await expect(dialog(page)).toHaveCount(0);
});
