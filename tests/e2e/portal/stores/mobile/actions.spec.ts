import { expect, test } from "@playwright/test";
import { fitsInsideTable } from "../../../../support/admin";

test("mobile keyboard users can reach store row actions through the table region", async ({
  page,
}) => {
  await page.goto("/stores");
  await expect(page.getByRole("heading", { name: "Stores", level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const table = page.getByRole("region", { name: "Stores" });
  const edit = page.getByRole("button", { name: /^Edit / }).first();
  const remove = page.getByRole("button", { name: /^Delete / }).first();
  await expect(edit).toBeVisible();
  await table.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("Tab");
  await expect(edit).toBeFocused();
  await expect(edit).toBeInViewport();
  const editBounds = await fitsInsideTable(edit);
  expect(editBounds, JSON.stringify(editBounds)).toMatchObject({ fits: true });

  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Edit store" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(edit).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(remove).toBeFocused();
  await expect(remove).toBeInViewport();
  const removeBounds = await fitsInsideTable(remove);
  expect(removeBounds, JSON.stringify(removeBounds)).toMatchObject({ fits: true });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(remove).toBeFocused();
});
