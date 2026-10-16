import { expect, test } from "@playwright/test";
import { calls, openSale } from "./harness";

test("cashier can void a held sale with a reason without replacing the active basket", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSale(page, "lines");
  await page.keyboard.press("F7");
  const held = page.getByRole("dialog", { name: "Held sales" });
  await expect(held).toBeVisible();
  await held.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const resumeLabel = held
    .getByRole("button", { name: /Resume Milo customer/ })
    .locator("span")
    .first();
  expect(await resumeLabel.evaluate((element) => getComputedStyle(element).textOverflow)).not.toBe(
    "ellipsis",
  );
  await held.getByRole("button", { name: "Void Milo customer" }).click();

  const voidDialog = page.getByRole("dialog", { name: "Void sale" });
  await expect(voidDialog).toBeVisible();
  await voidDialog.getByRole("textbox", { name: "Reason" }).fill("Customer changed their mind");
  await voidDialog.getByRole("button", { name: "Void sale" }).click();

  await expect(held.getByRole("button", { name: /Resume Milo customer/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Basket" })).toContainText("Milo 400g tin");
  await expect(page.getByRole("region", { name: "Tender" })).toContainText("GH₵ 126.50");
  expect(await calls(page, "voidSale")).toEqual([
    {
      type: "voidSale",
      args: ["Customer changed their mind", "10000000-0000-7000-8000-000000000007", 1],
    },
  ]);
});

test("held sale void is hidden without manager permission", async ({ page }) => {
  await openSale(page, "no-void-permission");
  await page.keyboard.press("F7");
  const held = page.getByRole("dialog", { name: "Held sales" });
  await expect(held.getByRole("button", { name: /Void/ })).toHaveCount(0);
  await expect(held).toContainText("Manager permission is required to void a sale.");
});
