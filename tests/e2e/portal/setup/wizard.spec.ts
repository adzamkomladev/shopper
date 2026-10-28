import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";
import {
  newRegistration,
  submitPassword,
  submitSignup,
  verifyFromEmail,
} from "../../../support/publicauth/flow";

// A new owner is taken from signup into the setup wizard and works through it by keyboard: each step's own form
// (the back office's sheets and tax settings), Products skipped, a till code with its QR, then Finish.
// S8's milestone spec carries on from here to an enrolled till.
test("a new owner sets the shop up step by step and finishes", async ({ page, request }) => {
  const data = newRegistration();
  await submitSignup(page, data);
  await verifyFromEmail(page, request, data);
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/setup/);
  await expect(page.getByRole("heading", { name: "Get your shop ready" })).toBeVisible();
  await expectStep(page, "Store");
  await expectNoSeriousAxe(page);

  await page.getByRole("button", { name: "Add store" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Main store");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expectStep(page, "Branch");
  await expect(rail(page, "Store")).toHaveAccessibleDescription(/done/i);

  await page.getByRole("button", { name: "Add branch" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Osu");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expectStep(page, "Tax");

  await page.getByLabel("Business TIN").fill("C0012345678");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expectStep(page, "Products");

  await page.getByRole("button", { name: "Skip for now" }).click();
  await expectStep(page, "Team");
  await expect(rail(page, "Products")).toHaveAccessibleDescription(/done/i);

  // Progress is read from the shop's data, so a reload lands on the same step.
  await page.reload();
  await expectStep(page, "Team");
  await page.keyboard.press("Alt+6");
  await expectStep(page, "Till");
  await page.getByRole("button", { name: "Create enrolment code" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Branch").click();
  await page.getByRole("option", { name: "Osu" }).click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(dialog.getByLabel("Enrolment code")).toHaveText(/\d{3} \d{3}/);
  await expect(dialog.getByRole("img", { name: /QR code/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  // The step is done once a till enrols with the code, not when the code is made.
  await expect(rail(page, "Till")).toHaveAccessibleDescription(/to do/i);

  await page.keyboard.press("Alt+7");
  await expectStep(page, "Done");
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/products$/);
  // Finished: the shop's front door no longer leads to the wizard.
  await page.goto("/");
  await expect(page).toHaveURL(/\/products$/);
});

test("leaving the wizard keeps a way back until the first sale", async ({ page, request }) => {
  const data = newRegistration();
  await submitSignup(page, data);
  await verifyFromEmail(page, request, data);
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/setup/);
  await page.getByRole("button", { name: "Finish later" }).click();
  await expect(page).toHaveURL(/\/products$/);
  const banner = page.getByRole("region", { name: "Shop setup" });
  await expect(banner).toContainText("0 of 6");
  await banner.getByRole("link", { name: "Continue setup" }).click();
  await expectStep(page, "Store");
});

const rail = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Setup steps" }).getByRole("link", { name });

async function expectStep(page: Page, name: string) {
  await expect(rail(page, name)).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("heading", { level: 2, name: new RegExp(name) })).toBeVisible();
}
