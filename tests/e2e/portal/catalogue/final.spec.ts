import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";
import { card, openProduct } from "../../../support/catalogue";

const label = "Final sale (cannot be returned)";
const finalSwitch = (page: Page) => card(page, "Details").getByRole("switch", { name: label });

test.describe("the final-sale switch on the product page, as the owner of E2E Mart", () => {
  test("it starts off, and a click then Save keeps it on after a reload", async ({
    page,
    request,
  }) => {
    await openProduct(page, request, "Clearance");
    await expect(finalSwitch(page)).not.toBeChecked();
    await expectNoSeriousAxe(page);
    await finalSwitch(page).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();

    await page.reload();
    await expect(finalSwitch(page)).toBeChecked();
  });

  test("Space toggles it with the keyboard alone and Mod+S saves; turning it off persists too", async ({
    page,
    request,
  }) => {
    await openProduct(page, request, "Seasonal");
    await finalSwitch(page).focus();
    await page.keyboard.press("Space");
    await expect(finalSwitch(page)).toBeChecked();
    await page.keyboard.press("ControlOrMeta+S");
    await expect(page.getByText("Changes saved")).toBeVisible();
    await page.reload();
    await expect(finalSwitch(page)).toBeChecked();

    await finalSwitch(page).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ControlOrMeta+S");
    await expect(page.getByText("Changes saved")).toBeVisible();
    await page.reload();
    await expect(finalSwitch(page)).not.toBeChecked();
  });
});
