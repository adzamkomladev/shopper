import { expect, test, type APIRequestContext } from "@playwright/test";
import { captureSizes, createBranch, shopHeaders, unique } from "../../../support/admin";
import { dialog } from "../../../support/admin/people";
import { BOX_API, expectNoSeriousAxe } from "../../../support/e2e";

// Day 32: the owner sets how a branch takes online orders from the branch list, by keyboard, and sees it again.
async function accraStore(request: APIRequestContext) {
  const response = await request.get(`${BOX_API}/stores`, { headers: await shopHeaders(request) });
  const stores = (await response.json()) as { id: string; name: string }[];
  return stores.find((store) => store.name === "Accra Store")!;
}

test("the owner turns on delivery with a fee and the branch keeps it", async ({
  page,
  request,
}, info) => {
  const branch = await createBranch(request, `Labone ${unique()}`, (await accraStore(request)).id);
  await page.goto("/branches");
  const open = page.getByRole("button", { name: `Online orders at ${branch.name}` });
  await expect(open).toBeVisible({ timeout: 20_000 });
  await open.click();
  const sheet = dialog(page);
  await expect(
    sheet.getByRole("heading", { name: `Online orders at ${branch.name}` }),
  ).toBeVisible();
  await expect(sheet.getByRole("switch", { name: "Pickup" })).not.toBeChecked();
  await expect(sheet.getByLabel("Delivery fee (GH₵)")).toHaveCount(0);

  await sheet.getByRole("switch", { name: "Pickup" }).click();
  await sheet.getByRole("switch", { name: "Delivery" }).click();
  await sheet.getByLabel("Delivery fee (GH₵)").fill("15.00");
  await sheet.getByLabel("Until", { exact: true }).fill("07:00");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(sheet.getByText("Closing must be after opening")).toBeVisible();
  await expect(sheet.getByLabel("Until", { exact: true })).toBeFocused();
  await sheet.getByLabel("Until", { exact: true }).fill("21:00");
  await captureSizes(page, info, "branches-online-orders", async () => {
    await expect(sheet).toBeVisible();
    await expectNoSeriousAxe(page);
  });
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Online orders saved")).toBeVisible();
  await expect(sheet).toBeHidden();
  await expect(open).toBeFocused();

  await open.click();
  await expect(sheet.getByRole("switch", { name: "Delivery" })).toBeChecked();
  await expect(sheet.getByLabel("Delivery fee (GH₵)")).toHaveValue("15.00");
  await expect(sheet.getByLabel("Until", { exact: true })).toHaveValue("21:00");
});
