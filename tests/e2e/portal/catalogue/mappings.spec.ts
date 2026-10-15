import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";
import {
  clearMappings,
  priceLayout,
  seedMapping,
  shoot,
  weightLayout,
} from "../../../support/catalogue/mappings";

const dialog = (page: Page) => page.getByRole("dialog");
const rowOf = (page: Page, prefix: number) =>
  page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: String(prefix), exact: true }) });
const field = (page: Page, label: string) => dialog(page).getByLabel(label, { exact: true });
// Fields with a hint read the error first, then the hint (the shared TextField convention).
const errorFirst = (message: string) =>
  new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

test.describe("barcode layouts as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page, request }) => {
    await clearMappings(request);
    await page.goto("/barcodes");
    // The first lazy route includes cold dev-server compilation before it can render.
    await expect(page.getByRole("heading", { name: "Barcode layouts", level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("N opens the form on Prefix, and a prefix alone saves the usual scale layout", async ({
    page,
  }, info) => {
    await page.keyboard.press("n");
    await expect(field(page, "Prefix")).toBeFocused();
    await expect(field(page, "Product code starts at digit")).toHaveValue("3");
    await page.keyboard.type("21");
    await shoot(page, info, "form-new", async () => {
      await expect(page.getByRole("img", { name: /Barcode layout/ })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Layout added")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    const row = rowOf(page, 21);
    await expect(row).toContainText("Weight in kg");
    await expect(row).toContainText("Digits 3–7");
    await expect(row).toContainText("Digits 8–12, 3 decimals");
    await expect(page.getByRole("button", { name: "Add layout" })).toBeFocused();
  });

  test("the preview follows the digits as they are typed", async ({ page }) => {
    await page.keyboard.press("n");
    const preview = page.getByRole("img", { name: /Barcode layout/ });
    await expect(preview).toHaveAccessibleName(/digits 3–7 product code.*digits 8–12 weight/);
    await field(page, "Product code length (digits)").fill("4");
    await field(page, "Value starts at digit").fill("7");
    await expect(preview).toHaveAccessibleName(/digits 3–6 product code.*digits 7–11 weight/);
    await dialog(page).getByRole("combobox", { name: "Label type" }).click();
    await page.getByRole("option", { name: "Price" }).click();
    await expect(preview).toHaveAccessibleName(/digits 7–11 price/);
    await expect(dialog(page).getByRole("combobox", { name: "Weight unit" })).toHaveCount(0);
  });

  test("a price layout is added by Tab and the keyboard alone", async ({ page }) => {
    await page.keyboard.press("n");
    await page.keyboard.type("24");
    await page.keyboard.press("Tab");
    await expect(dialog(page).getByRole("combobox", { name: "Label type" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "Price" }).click();
    await field(page, "Decimal places").fill("2");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Layout added")).toBeVisible();
    await expect(rowOf(page, 24)).toContainText("Price");
    await expect(rowOf(page, 24)).toContainText("2 decimals");
  });

  test("overlapping digits are explained in plain words on the field to fix", async ({
    page,
  }, info) => {
    await page.keyboard.press("n");
    await page.keyboard.type("21");
    await field(page, "Value starts at digit").fill("6");
    await page.keyboard.press("ControlOrMeta+Enter");
    const start = field(page, "Value starts at digit");
    await expect(start).toBeFocused();
    await expect(start).toHaveAttribute("aria-invalid", "true");
    await expect(start).toHaveAccessibleDescription(
      "Product code (digits 3–7) and weight (digits 6–10) share digits 6–7. Move one of them so they don't overlap.",
    );
    await expect(dialog(page)).toBeVisible();
    await shoot(page, info, "form-overlap", async () => {
      await expect(start).toHaveAttribute("aria-invalid", "true");
      await expectNoSeriousAxe(page);
    });
  });

  test("digits past the data area, and bad numbers, are refused with a reason", async ({
    page,
  }) => {
    await page.keyboard.press("n");
    await page.keyboard.type("21");
    await field(page, "Value starts at digit").fill("10");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(field(page, "Value starts at digit")).toHaveAccessibleDescription(
      "Weight digits 10–14 run past digit 12. Digit 13 is the check digit, so the data must stop at digit 12.",
    );
    await field(page, "Value starts at digit").fill("8");
    await field(page, "Prefix").fill("35");
    await field(page, "Decimal places").fill("9");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(field(page, "Prefix")).toBeFocused();
    await expect(field(page, "Prefix")).toHaveAccessibleDescription(
      errorFirst("Use a number from 20 to 29"),
    );
    await expect(field(page, "Decimal places")).toHaveAccessibleDescription(
      errorFirst("Use a number from 0 to 4"),
    );
  });

  test("a prefix that already has a layout is refused before saving", async ({ page, request }) => {
    await seedMapping(request, weightLayout(22));
    await page.reload();
    await expect(rowOf(page, 22)).toBeVisible();
    await page.keyboard.press("n");
    await page.keyboard.type("22");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(field(page, "Prefix")).toHaveAccessibleDescription(
      errorFirst("Prefix 22 already has a layout. Edit that one instead."),
    );
  });

  test("a prefix taken since the list loaded is refused by the server on the Prefix field", async ({
    page,
    request,
  }) => {
    await seedMapping(request, weightLayout(23));
    await page.keyboard.press("n");
    await page.keyboard.type("23");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(field(page, "Prefix")).toHaveAccessibleDescription(
      errorFirst("Prefix 23 already has a layout. Edit that one instead."),
    );
    await expect(field(page, "Prefix")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog(page)).toBeVisible();
  });

  test("edit a layout: change its decimals, then turn it into a price layout", async ({
    page,
    request,
  }) => {
    await seedMapping(request, weightLayout(25));
    await page.reload();
    await page.getByRole("button", { name: "Edit prefix 25" }).click();
    await expect(dialog(page).getByRole("heading", { name: "Edit layout" })).toBeVisible();
    await expect(field(page, "Prefix")).toHaveValue("25");
    await field(page, "Decimal places").fill("2");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Layout saved")).toBeVisible();
    await expect(rowOf(page, 25)).toContainText("2 decimals");
    await expect(page.getByRole("button", { name: "Edit prefix 25" })).toBeFocused();

    await page.getByRole("button", { name: "Edit prefix 25" }).click();
    await dialog(page).getByRole("combobox", { name: "Label type" }).click();
    await page.getByRole("option", { name: "Price" }).click();
    await page.keyboard.press("ControlOrMeta+Enter");
    // The first save's toast may still be showing.
    await expect(page.getByText("Layout saved").last()).toBeVisible();
    await expect(rowOf(page, 25)).toContainText("Price");
    await expect(rowOf(page, 25)).not.toContainText("kg");
  });

  test("delete asks first; Escape keeps the layout and returns focus, confirming removes it", async ({
    page,
    request,
  }, info) => {
    await seedMapping(request, weightLayout(26));
    await seedMapping(request, priceLayout(27));
    await page.reload();
    const trigger = page.getByRole("button", { name: "Delete prefix 26" });
    await trigger.click();
    await expect(dialog(page)).toContainText("Delete the layout for prefix 26?");
    await shoot(page, info, "delete-confirm", async () => {
      await expect(dialog(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(rowOf(page, 26)).toBeVisible();
    await trigger.click();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Layout deleted")).toBeVisible();
    await expect(rowOf(page, 26)).toHaveCount(0);
    await expect(rowOf(page, 27)).toBeVisible();
  });

  test("the list renders with layouts and has no serious axe violations", async ({
    page,
    request,
  }, info) => {
    await seedMapping(request, weightLayout(21));
    await seedMapping(request, priceLayout(28));
    await page.reload();
    await shoot(page, info, "list", async () => {
      await expect(page.getByRole("heading", { name: "Barcode layouts", level: 1 })).toBeVisible();
      await expect(rowOf(page, 28)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
