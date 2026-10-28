import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";
import {
  newRegistration,
  submitPassword,
  submitSignup,
  verifyFromEmail,
} from "../../../support/publicauth/flow";

const shots = process.env.SHOPPER_SCREENSHOTS_DIR;

// A new owner who leaves the wizard finds every screen it covers empty, saying what goes there, with a way to
// add it and a way back into the matching wizard step.
const screens = [
  { path: "/stores", empty: "No stores yet", step: "Store" },
  { path: "/branches", empty: "Add a store first", step: "Store" },
  { path: "/products", empty: "No products yet", step: "Products" },
  { path: "/users", empty: "No invitations yet", step: "Team" },
  { path: "/devices", empty: "No devices yet", step: "Till" },
] as const;

test("each screen the wizard covers is empty, explained, and leads back to its step", async ({
  page,
  request,
}) => {
  await signUpAndLeaveSetup(page, request);
  for (const screen of screens) {
    await page.goto(screen.path);
    await expect(page.getByRole("heading", { name: screen.empty })).toBeVisible();
    await expectNoSeriousAxe(page);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        `${screen.path} overflows at ${width}`,
      ).toBe(false);
      // The page can stay put while the buttons spill out of the empty box itself.
      expect(await spills(page), `${screen.path} spills its empty box at ${width}`).toBe(false);
      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({
          path: `${shots}/empty${screen.path.replace("/", "-")}-${width}.png`,
        });
      }
    }
    await page.getByRole("link", { name: "Back to setup" }).click();
    await expect(page).toHaveURL(/\/setup/);
    await expect(page.getByRole("heading", { level: 2, name: screen.step })).toBeVisible();
  }
});

async function signUpAndLeaveSetup(page: Page, request: Parameters<typeof verifyFromEmail>[1]) {
  const data = newRegistration();
  await submitSignup(page, data);
  await verifyFromEmail(page, request, data);
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Finish later" }).click();
}

/** Whether any action in the empty state reaches past the edges of its box. */
function spills(page: Page) {
  return page
    .locator('[data-slot="empty"]')
    .first()
    .evaluate((box) => {
      const outer = box.getBoundingClientRect();
      return [...box.querySelectorAll("a, button")].some((action) => {
        const inner = action.getBoundingClientRect();
        return inner.left < outer.left - 0.5 || inner.right > outer.right + 0.5;
      });
    });
}
