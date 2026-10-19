import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../../support/e2e";
import { calls, openSale } from "../harness";

const held = (page: Page) => page.getByRole("dialog");
const heldId = "10000000-0000-7000-8000-000000000007";

async function openHeldVoid(page: Page, scenario: string) {
  await openSale(page, scenario);
  await page.keyboard.press("F7");
  await expect(held(page)).toBeVisible();
  await held(page).getByRole("button", { name: "Void Milo customer" }).click();
  await expect(held(page)).toHaveCount(1);
}

test("voiding a held sale with cash taken asks for a manager inside the same dialog", async ({
  page,
}) => {
  await openHeldVoid(page, "held-void-cash");
  await expect(held(page)).toContainText("Cash was taken. A manager must approve this void.");
  await expect(held(page).getByRole("textbox", { name: "Reason" })).toBeFocused();
  await page.keyboard.type("Customer left");
  await expect(held(page).getByRole("button", { name: /^Void sale/ })).toBeDisabled();
  const manager = page.getByRole("combobox", { name: "Manager" });
  await manager.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Kofi Mensah" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Abena Owusu" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(manager).toContainText("Abena Owusu");
  await page.keyboard.press("Tab");
  await page.keyboard.type("0000");
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Wrong PIN. 4 tries left");
  await expect(page.getByLabel("Manager PIN")).toBeFocused();
  await page.keyboard.type("4321");
  await page.keyboard.press("Enter");

  await expect(held(page)).toHaveCount(0);
  expect((await calls(page, "voidSale")).at(-1)?.args).toEqual([
    "Customer left",
    heldId,
    1,
    { approverId: "10000000-0000-7000-8000-000000000021", pin: "4321" },
  ]);
});

test("a held sale with a card payment says a card was taken and Back returns to the list", async ({
  page,
}) => {
  await openHeldVoid(page, "held-void-card");
  await expect(held(page)).toContainText(
    "A card payment was taken. A manager must approve this void.",
  );
  await held(page)
    .getByRole("button", { name: /^Back to held sales/ })
    .click();
  await expect(held(page).getByRole("button", { name: /Resume Milo customer/ })).toBeVisible();
});

test("a held sale with no payment is still voided with a reason alone", async ({ page }) => {
  await openHeldVoid(page, "lines");
  await expect(page.getByRole("combobox", { name: "Manager" })).toHaveCount(0);
  await held(page).getByRole("textbox", { name: "Reason" }).fill("Changed their mind");
  await page.keyboard.press("F11");
  await expect(held(page)).toHaveCount(0);
  expect((await calls(page, "voidSale")).at(-1)?.args).toEqual(["Changed their mind", heldId, 1]);
});

test("the held approval fields fit the till and mobile screens", async ({ page }, testInfo) => {
  for (const [width, height, name] of [
    [1366, 768, "till"],
    [390, 844, "mobile"],
  ] as const) {
    await openHeldVoid(page, "held-void-cash");
    await page.setViewportSize({ width, height });
    const dialog = held(page);
    await dialog.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)));
    const box = await dialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.screenshot({ path: testInfo.outputPath(`held-void-${name}.png`) });
  }
});
