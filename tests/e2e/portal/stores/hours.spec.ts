import { expect, test, type Page } from "@playwright/test";
import { createStore, unique } from "../../../support/admin";

// Store hours on the saved owner session: the store-day workflow opens and closes the day by them.
const dialog = (page: Page) => page.getByRole("dialog");

test.beforeEach(async ({ page }) => {
  await page.goto("/stores");
  await expect(page.getByRole("heading", { name: "Stores", level: 1 })).toBeVisible();
});

test("set a store's hours, and closing before opening is refused on Closes", async ({
  page,
  request,
}) => {
  const store = await createStore(request, `Cape Coast ${unique()}`);
  await page.reload();
  await page.getByRole("button", { name: `Edit ${store.name}` }).click();
  await expect(dialog(page).getByLabel("Opens")).toHaveValue("07:00");
  await expect(dialog(page).getByLabel("Closes")).toHaveValue("21:00");
  await dialog(page).getByLabel("Opens").fill("08:30");
  await dialog(page).getByLabel("Closes").fill("08:00");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(dialog(page).getByLabel("Closes")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog(page)).toContainText("The store must close after it opens");
  await dialog(page).getByLabel("Closes").fill("20:00");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Store saved")).toBeVisible();
  await page.getByRole("button", { name: `Edit ${store.name}` }).click();
  await expect(dialog(page).getByLabel("Opens")).toHaveValue("08:30");
  await expect(dialog(page).getByLabel("Closes")).toHaveValue("20:00");
});
