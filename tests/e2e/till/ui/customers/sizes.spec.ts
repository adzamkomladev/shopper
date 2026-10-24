// The customer dialog, chip and disabled tiles at the six sizes: layout, touch targets, axe and screenshots.
import { test, expect } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { openSale } from "../sale/harness";
import { expectTouchTargets } from "../targets";
import { chip, dialog, expectFits, lookup, shoot, sizes } from "./harness";

for (const size of sizes) {
  test(`at ${size.name}: find, duplicates, quick-create, edit, offline and the chip fit`, async ({
    page,
  }) => {
    // Six axe passes and a screenshot per state: slow on a busy machine.
    test.setTimeout(120_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await openSale(page, "customers");
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.keyboard.press("Alt+U");
    await expect(dialog(page)).toBeVisible();
    await expectFits(page, size.width);
    await expectNoSeriousAxe(page);
    await shoot(page, `dialog-find-${size.name}`);

    await lookup(page, "0241234567");
    await expect(dialog(page).getByRole("option")).toHaveCount(1);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `dialog-match-${size.name}`);

    await page.keyboard.press("Control+a");
    await page.keyboard.type("0240000002");
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toContainText("2 customers use this number");
    await expectFits(page, size.width);
    await expectNoSeriousAxe(page);
    await shoot(page, `dialog-duplicates-${size.name}`);

    await page.keyboard.press("Control+a");
    await page.keyboard.type("0249999999");
    await page.keyboard.press("Enter");
    await dialog(page).getByRole("button", { name: "Business" }).click();
    await expect(dialog(page).getByRole("textbox", { name: "TIN", exact: true })).toBeVisible();
    await page.keyboard.press("Control+Enter");
    await expect(dialog(page).getByRole("textbox", { name: "Name", exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expectFits(page, size.width);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `dialog-create-${size.name}`);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Add customer" }).click();
    await lookup(page, "0241234567");
    await expect(dialog(page).getByRole("option")).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(chip(page)).toContainText("Ama Mensah");
    await expectFits(page, size.width);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `chip-${size.name}`);
    await page.keyboard.press("Alt+E");
    await expect(dialog(page, "Edit customer")).toBeVisible();
    await expectFits(page, size.width);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `dialog-edit-${size.name}`);
  });

  test(`at ${size.name}: offline note and the disabled tiles fit`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    await openSale(page, "customers-offline");
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.keyboard.press("Alt+U");
    await expect(dialog(page)).toContainText("New customers upload when the register reconnects");
    await expectFits(page, size.width);
    await expectNoSeriousAxe(page);
    await shoot(page, `dialog-offline-${size.name}`);
    await page.keyboard.press("Escape");
    await openSale(page, "customers-nopermission");
    await page.setViewportSize({ width: size.width, height: size.height });
    await expectFits(page, size.width);
    await expectTouchTargets(page);
    await shoot(page, `tiles-nopermission-${size.name}`);
  });
}
