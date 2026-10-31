// A register below the server's minimum version opens no new shift: once no shift is open, the signed-in cashier sees
// the Update required screen until the update installs. During a shift, or when an optional update is ready, the
// shell shows a banner instead and the cashier keeps selling.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectTouchTargets } from "../targets";

const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1366", width: 1366, height: 768 },
  { name: "till", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;
const states = ["checking", "downloading", "ready", "error", "offline"] as const;

const open = (page: Page, scenario: string) =>
  page.goto(`/harness/update.html?scenario=${scenario}`);
const calls = (page: Page) => page.evaluate(() => window.updateCalls);
const heading = (page: Page) => page.getByRole("heading", { name: "Update required" });

async function expectFits(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}

for (const size of sizes)
  test(`every state at ${size.name} names the version and fits`, async ({ page }) => {
    await page.setViewportSize(size);
    for (const state of states) {
      await open(page, state);
      await expect(heading(page)).toBeVisible();
      await expect(page.getByText("0.2.0", { exact: false }).first()).toBeVisible();
      await expectFits(page);
      await expectTouchTargets(page);
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: `${shots}/update-${state}-${size.name}.png` });
      }
    }
  });

test("checking and downloading say what is happening and offer nothing to press", async ({
  page,
}) => {
  await open(page, "checking");
  await expect(page.getByText("Looking for the update")).toBeVisible();
  await expect(page.getByRole("button", { name: /Restart now|Retry/ })).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await open(page, "downloading");
  await expect(page.getByRole("progressbar", { name: "Download progress" })).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await expect(page.getByText("42%")).toBeVisible();
});

test("ready restarts from the button or Alt+U", async ({ page }) => {
  await open(page, "ready");
  const restart = page.getByRole("button", { name: /Restart now/ });
  await expect(restart).toBeFocused();
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Alt+U");
  await restart.click();
  expect(await calls(page)).toEqual(["install", "install"]);
});

test("a failed download retries from the button or Alt+R", async ({ page }) => {
  await open(page, "error");
  await expect(page.getByText("The download did not finish")).toBeVisible();
  const retry = page.getByRole("button", { name: /Retry/ });
  await expect(retry).toBeFocused();
  await page.keyboard.press("Alt+R");
  await retry.click();
  expect(await calls(page)).toEqual(["check", "check"]);
});

test("offline says the update downloads once the register is back online", async ({ page }) => {
  await open(page, "offline");
  await expect(page.getByText("Connect this register to the internet")).toBeVisible();
  await expect(page.getByRole("button", { name: /Restart now/ })).toHaveCount(0);
  await expectNoSeriousAxe(page);
});

test("the cashier can sign out from the update screen", async ({ page }) => {
  await open(page, "checking");
  await page.getByRole("button", { name: /Sign out/ }).click();
  expect(await calls(page)).toEqual(["signOut"]);
});

test("the shell says when an update waits for the shift to close, and when one is ready", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/harness/index.html?update=required");
  await expect(
    page.getByRole("status").filter({ hasText: "Close this shift to install version 0.2.0" }),
  ).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/update-banner-required.png` });
  await page.goto("/harness/index.html?update=ready");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Version 0.2.0 installs when this register next restarts" }),
  ).toBeVisible();
  await expectFits(page);
  if (shots) await page.screenshot({ path: `${shots}/update-banner-ready.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectFits(page);
});
