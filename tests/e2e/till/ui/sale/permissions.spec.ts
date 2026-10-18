import { expect, test } from "@playwright/test";
import { calls, openCheckout, openSale } from "./harness";

test("missing MoMo permission leaves cash checkout available", async ({ page }) => {
  await openSale(page, "no-momo-permission");
  await openCheckout(page);
  const momo = page.getByRole("button", { name: /MoMo/ });
  await expect(momo).toBeDisabled();
  await expect(
    page.getByText("Mobile money permission is required for this register."),
  ).toBeVisible();
  await page.keyboard.press("Alt+2");
  await expect(page.getByRole("dialog", { name: "Mobile money payment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cash" })).toBeEnabled();
  await page.keyboard.press("Alt+4");
  expect(await calls(page, "startMomo")).toHaveLength(0);
  expect(await calls(page, "addTender")).toEqual([
    { type: "addTender", args: [{ kind: "cash", amount: 1_265_000 }] },
  ]);
});
