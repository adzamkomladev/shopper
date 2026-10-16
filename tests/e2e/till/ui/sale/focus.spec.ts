import { expect, test } from "@playwright/test";
import { openSale } from "./harness";

test("closing tender overlays returns focus to the scan field", async ({ page }) => {
  const scan = page.getByRole("combobox", { name: "Scan barcode or search items" });
  await openSale(page, "lines");
  await closeOverlay(page, "Alt+3", "Card payment");
  await expect(scan).toBeFocused();

  await closeOverlay(page, "Alt+2", "Mobile money payment");
  await expect(scan).toBeFocused();

  await closeOverlay(page, "F7", "Held sales");
  await expect(scan).toBeFocused();

  await closeOverlay(page, "F11", "Void sale");
  await expect(scan).toBeFocused();
});

async function closeOverlay(page: import("@playwright/test").Page, key: string, title: string) {
  await page.keyboard.press(key);
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toHaveCount(0);
}
